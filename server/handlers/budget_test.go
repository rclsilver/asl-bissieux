package handlers

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/juju/errors"

	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
	appauth "github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/money"
	serverauth "github.com/rclsilver/asl-bissieux/server/auth"
)

func TestBudgetPaymentIntegration(t *testing.T) {
	conn, pool := testdb.Open(t)
	pool.SetMaxOpenConns(1)
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/", nil)
	user := appauth.NewUser("test@example.invalid", true, true, nil)
	budget := models.NewBudget("Integration test")
	unit := models.NewUnit(1, "Test address", 1)
	for _, row := range []any{user, budget, unit} {
		if err := conn.Create(row).Error; err != nil {
			t.Fatal(err)
		}
	}
	c.Set(serverauth.CurrentUser, user)
	cotisation := models.NewCotisation(budget.ID, unit.ID, money.Euros(100))
	if err := conn.Create(cotisation).Error; err != nil {
		t.Fatal(err)
	}
	input := createPaymentIn{BudgetID: budget.ID, CotisationID: cotisation.ID, Date: time.Now().UTC(), Amount: money.Euros(25), Comment: "initial"}
	assertReleased := func(t *testing.T) {
		t.Helper()
		if count := pool.Stats().InUse; count != 0 {
			t.Fatalf("%d connection(s) still in use after handler returned", count)
		}
	}
	var paymentID string
	t.Run("create update delete persist and release connections", func(t *testing.T) {
		payment, err := CreatePayment(c, &input)
		if err != nil {
			t.Fatal(err)
		}
		paymentID = payment.ID
		assertReleased(t)
		updated := input
		updated.Amount, updated.Comment = money.Euros(50), "updated"
		if _, err := UpdatePayment(c, &updatePaymentIn{createPaymentIn: updated, PaymentID: paymentID}); err != nil {
			t.Fatal(err)
		}
		assertReleased(t)
		var persisted models.Payment
		if err := conn.First(&persisted, "id = ?", paymentID).Error; err != nil || !persisted.Amount.Equal(money.Euros(50)) || persisted.Comment != "updated" {
			t.Fatalf("update not persisted: %+v, %v", persisted, err)
		}
	})
	if paymentID == "" {
		t.Fatal("payment fixture was not created")
	}
	t.Run("missing resources release connections", func(t *testing.T) {
		missing := input
		missing.CotisationID = uuid.New().String()
		for i := 0; i < 3; i++ {
			_, err := CreatePayment(c, &missing)
			if !errors.IsNotFound(err) {
				t.Fatalf("expected not found, got %v", err)
			}
			assertReleased(t)
			_, err = UpdatePayment(c, &updatePaymentIn{createPaymentIn: input, PaymentID: uuid.New().String()})
			if !errors.IsNotFound(err) {
				t.Fatalf("expected not found, got %v", err)
			}
			assertReleased(t)
			err = DeletePayment(c, &deletePaymentIn{BudgetID: budget.ID, CotisationID: cotisation.ID, PaymentID: uuid.New().String()})
			if !errors.IsNotFound(err) {
				t.Fatalf("expected not found, got %v", err)
			}
			assertReleased(t)
		}
	})
	t.Run("failed writes rollback and release connections", func(t *testing.T) {
		if err := conn.Exec("ALTER TABLE payment ADD CONSTRAINT test_write_failure CHECK (amount <> 13)").Error; err != nil {
			t.Fatal(err)
		}
		bad := input
		bad.Amount = money.Euros(13)
		if _, err := CreatePayment(c, &bad); err == nil {
			t.Fatal("expected create error")
		}
		assertReleased(t)
		if _, err := UpdatePayment(c, &updatePaymentIn{createPaymentIn: bad, PaymentID: paymentID}); err == nil {
			t.Fatal("expected update error")
		}
		assertReleased(t)
		var persisted models.Payment
		if err := conn.First(&persisted, "id = ?", paymentID).Error; err != nil || !persisted.Amount.Equal(money.Euros(50)) {
			t.Fatalf("failed update changed payment: %+v, %v", persisted, err)
		}
		if err := conn.Exec(`CREATE FUNCTION test_delete_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated delete failure'; END $$`).Error; err != nil {
			t.Fatal(err)
		}
		if err := conn.Exec(`CREATE TRIGGER test_delete_failure BEFORE UPDATE ON payment FOR EACH ROW WHEN (NEW.deleted_at IS NOT NULL) EXECUTE FUNCTION test_delete_failure()`).Error; err != nil {
			t.Fatal(err)
		}
		if err := DeletePayment(c, &deletePaymentIn{BudgetID: budget.ID, CotisationID: cotisation.ID, PaymentID: paymentID}); err == nil {
			t.Fatal("expected delete error")
		}
		assertReleased(t)
		if err := conn.First(&persisted, "id = ?", paymentID).Error; err != nil {
			t.Fatalf("failed delete removed payment: %v", err)
		}
		if err := conn.Exec("DROP TRIGGER test_delete_failure ON payment").Error; err != nil {
			t.Fatal(err)
		}
	})
	t.Run("successful delete and genuine empty lists", func(t *testing.T) {
		if err := DeletePayment(c, &deletePaymentIn{BudgetID: budget.ID, CotisationID: cotisation.ID, PaymentID: paymentID}); err != nil {
			t.Fatal(err)
		}
		assertReleased(t)
		if rows, err := ListPayments(c, &listPaymentsIn{BudgetID: budget.ID, CotisationID: cotisation.ID}); err != nil || len(rows) != 0 {
			t.Fatalf("expected empty payments: %v, %v", rows, err)
		}
		if rows, err := ListExpenses(c, &listExpensesIn{BudgetID: budget.ID}); err != nil || len(rows) != 0 {
			t.Fatalf("expected empty expenses: %v, %v", rows, err)
		}
	})
	t.Run("list errors are propagated", func(t *testing.T) {
		missing := uuid.New().String()
		_, expenseErr := ListExpenses(c, &listExpensesIn{BudgetID: missing})
		_, cotisationErr := ListCotisations(c, &listCotisationsIn{BudgetID: missing})
		_, paymentErr := ListPayments(c, &listPaymentsIn{BudgetID: budget.ID, CotisationID: missing})
		for _, err := range []error{expenseErr, cotisationErr, paymentErr} {
			if !errors.IsNotFound(err) {
				t.Fatalf("expected resource not found, got %v", err)
			}
		}
		// Closing only this run's isolated pool simulates a database outage.
		pool.Close()
		_, budgetErr := ListBudgets(c, &listBudgetsIn{})
		_, expenseErr = ListExpenses(c, &listExpensesIn{BudgetID: budget.ID})
		_, cotisationErr = ListCotisations(c, &listCotisationsIn{BudgetID: budget.ID})
		_, paymentErr = ListPayments(c, &listPaymentsIn{BudgetID: budget.ID, CotisationID: cotisation.ID})
		for _, err := range []error{budgetErr, expenseErr, cotisationErr, paymentErr} {
			if err == nil {
				t.Fatal("database failure was hidden")
			}
		}
	})
}
