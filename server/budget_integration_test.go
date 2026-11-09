package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rclsilver/asl-bissieux/controllers"
	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/money"
	"github.com/rclsilver/asl-bissieux/server/handlers"
)

// Embedding supplies the provider's private validation method; the real HTTP
// authentication/permission middleware still runs against these test accounts.
type budgetTestProvider struct {
	auth.AuthProvider
	users map[string]*auth.User
}

func (p *budgetTestProvider) Authenticate(r *http.Request) (*auth.User, error) {
	return p.users[r.Header.Get("X-Test-Role")], nil
}

func TestBudgetPublicationHTTP(t *testing.T) {
	conn, pool := testdb.Open(t)
	gin.SetMode(gin.TestMode)
	actions := []string{handlers.CreateBudgetAction, handlers.UpdateBudgetAction, handlers.DeleteBudgetAction, handlers.PublishBudgetAction, handlers.CreateExpenseAction, handlers.UpdateExpenseAction, handlers.DeleteExpenseAction, handlers.CreatePaymentAction, handlers.UpdatePaymentAction, handlers.DeletePaymentAction}
	users := map[string]*auth.User{
		"admin":    auth.NewUser("admin@example.invalid", true, true, nil),
		"operator": auth.NewUser("operator@example.invalid", true, false, actions),
		"viewer":   auth.NewUser("viewer@example.invalid", true, false, nil),
		"disabled": auth.NewUser("disabled@example.invalid", false, true, nil),
	}
	for _, user := range users {
		if err := conn.Create(user).Error; err != nil {
			t.Fatal(err)
		}
	}
	for i := 1; i <= 3; i++ {
		if err := conn.Create(models.NewUnit(i, string(rune('A'+i)), 1)).Error; err != nil {
			t.Fatal(err)
		}
	}
	app := NewServer().WithAuthProvider(&budgetTestProvider{users: users})
	if err := app.Build(); err != nil {
		t.Fatal(err)
	}
	request := func(role, method, path, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("X-Test-Role", role)
		w := httptest.NewRecorder()
		app.apiRouter.ServeHTTP(w, r)
		return w
	}
	check := func(t *testing.T, w *httptest.ResponseRecorder, expected int) {
		t.Helper()
		if w.Code != expected {
			t.Fatalf("HTTP %d, expected %d: %s", w.Code, expected, w.Body.String())
		}
	}
	newDraft := func(t *testing.T) (models.Budget, models.Expense) {
		t.Helper()
		w := request("admin", "POST", "/api/budget", `{"label":"Publication test"}`)
		check(t, w, 201)
		var budget models.Budget
		if err := json.Unmarshal(w.Body.Bytes(), &budget); err != nil {
			t.Fatal(err)
		}
		w = request("admin", "POST", "/api/budget/"+budget.ID+"/expenses", `{"label":"Expense","amount":300}`)
		check(t, w, 201)
		var expense models.Expense
		if err := json.Unmarshal(w.Body.Bytes(), &expense); err != nil {
			t.Fatal(err)
		}
		return budget, expense
	}
	for _, role := range []string{"admin", "operator"} {
		t.Run(role+" financial writes freeze but label and payments remain editable", func(t *testing.T) {
			budget, expense := newDraft(t)
			base := "/api/budget/" + budget.ID
			expensePath := base + "/expenses/" + expense.ID
			check(t, request(role, "PUT", expensePath, `{"label":"Updated expense","amount":600}`), 200)
			check(t, request(role, "POST", base+"/publish", `{}`), 200)
			cotisations, err := controllers.ListCotisations(conn, budget.ID)
			if err != nil || len(cotisations) != 3 {
				t.Fatalf("cotisations=%v, %v", cotisations, err)
			}
			paymentPath := base + "/cotisations/" + cotisations[0].ID + "/payments"
			w := request(role, "POST", paymentPath, `{"date":"2026-01-01T00:00:00Z","amount":25,"comment":"Keep this payment"}`)
			check(t, w, 201)
			var payment models.Payment
			json.Unmarshal(w.Body.Bytes(), &payment)
			check(t, request(role, "POST", base+"/expenses", `{"label":"Forbidden","amount":99}`), 403)
			check(t, request(role, "PUT", expensePath, `{"label":"Forbidden","amount":1}`), 403)
			check(t, request(role, "DELETE", expensePath, ``), 403)
			check(t, request(role, "DELETE", base, ``), 403)
			check(t, request(role, "POST", base+"/publish", `{}`), 400)
			check(t, request(role, "PUT", base, `{"label":"Renamed published budget","draft":true}`), 200)
			var stored models.Payment
			if err := conn.First(&stored, "id = ?", payment.ID).Error; err != nil || !stored.Amount.Equal(money.Euros(25)) {
				t.Fatalf("existing payment changed: %+v, %v", stored, err)
			}
			result, err := controllers.GetBudget(conn, budget.ID)
			if err != nil || result.Draft || !result.Amount.Equal(money.Euros(600)) || result.Label != "Renamed published budget" {
				t.Fatalf("published budget changed: %+v, %v", result, err)
			}
			check(t, request(role, "PUT", paymentPath+"/"+payment.ID, `{"date":"2026-01-02T00:00:00Z","amount":50,"comment":"Explicit payment update"}`), 200)
			check(t, request(role, "DELETE", paymentPath+"/"+payment.ID, ``), 204)
		})
	}
	t.Run("write permissions and disabled accounts are enforced", func(t *testing.T) {
		budget, expense := newDraft(t)
		base := "/api/budget/" + budget.ID
		for _, role := range []string{"viewer", "disabled", ""} {
			expected := 403
			if role != "viewer" {
				expected = 401
			}
			check(t, request(role, "POST", base+"/publish", `{}`), expected)
			check(t, request(role, "PUT", base, `{"label":"Not allowed"}`), expected)
			check(t, request(role, "PUT", base+"/expenses/"+expense.ID, `{"label":"Not allowed","amount":99}`), expected)
			check(t, request(role, "DELETE", base, ``), expected)
		}
	})
	t.Run("cent amounts preview and exact allocation through the HTTP API", func(t *testing.T) {
		budget, expense := newDraft(t)
		base := "/api/budget/" + budget.ID
		expensePath := base + "/expenses/" + expense.ID
		for _, amount := range []string{"0", "-1", "1.001", "10000000000", "null", `"1.00"`, "1e999999999"} {
			check(t, request("admin", "PUT", expensePath, `{"label":"Invalid","amount":`+amount+`}`), 400)
		}
		check(t, request("admin", "PUT", expensePath, `{"label":"Cent distribution","amount":100.01}`), 200)
		w := request("viewer", "GET", base, ``)
		check(t, w, 200)
		var before models.BudgetResult
		if err := json.Unmarshal(w.Body.Bytes(), &before); err != nil {
			t.Fatal(err)
		}
		if !before.Draft || before.Preview == nil || !before.Preview.Ready || before.Preview.TotalShares != 3 || before.Preview.AnnualPerShare.String() != "33.336667" || before.Preview.MonthlyPerShare.String() != "2.778056" {
			t.Fatalf("draft preview: %+v", before.Preview)
		}
		var cotisationCount int64
		conn.Model(&models.Cotisation{}).Where("budget_id=?", budget.ID).Count(&cotisationCount)
		if cotisationCount != 0 {
			t.Fatal("preview created cotisations")
		}
		check(t, request("admin", "POST", base+"/publish", `{}`), 200)
		rows, err := controllers.ListCotisations(conn, budget.ID)
		if err != nil || len(rows) != 3 {
			t.Fatalf("cotisations: %v, %v", rows, err)
		}
		var sum money.Amount
		for _, row := range rows {
			expected := "33.34"
			if row.Unit.Number == 3 {
				expected = "33.33"
			}
			if row.Amount.String() != expected {
				t.Fatalf("lot %d: %s", row.Unit.Number, row.Amount)
			}
			sum = sum.Add(row.Amount)
		}
		if !sum.Equal(before.Amount) {
			t.Fatalf("sum %s != %s", sum, before.Amount)
		}
		paymentPath := base + "/cotisations/" + rows[0].ID + "/payments"
		targetID, targetAmount := rows[0].ID, rows[0].Amount
		for _, amount := range []string{"0", "-1", "0.001", "null"} {
			check(t, request("admin", "POST", paymentPath, `{"date":"2026-01-01T00:00:00Z","amount":`+amount+`}`), 400)
		}
		for _, amount := range []string{"0.1", "0.2"} {
			check(t, request("admin", "POST", paymentPath, `{"date":"2026-01-01T00:00:00Z","amount":`+amount+`}`), 201)
		}
		rows, err = controllers.ListCotisations(conn, budget.ID)
		if err != nil {
			t.Fatal(err)
		}
		for _, row := range rows {
			if row.Paid.IsPositive() && row.Paid.String() != "0.3" {
				t.Fatalf("inexact payment sum: %s", row.Paid)
			}
		}
		rest := targetAmount.Sub(money.MustParse("0.3").Decimal)
		check(t, request("admin", "POST", paymentPath, `{"date":"2026-01-01T00:00:00Z","amount":`+rest.String()+`}`), 201)
		w = request("viewer", "GET", base+"/cotisations", ``)
		check(t, w, 200)
		if err := json.Unmarshal(w.Body.Bytes(), &rows); err != nil {
			t.Fatal(err)
		}
		for _, row := range rows {
			if row.ID == targetID && (row.PaymentState != 1 || !row.Remaining.IsZero()) {
				t.Fatalf("fully paid state: %+v", row)
			}
		}
		w = request("admin", "POST", paymentPath, `{"date":"2026-01-01T00:00:00Z","amount":0.01}`)
		check(t, w, 201)
		var payment models.Payment
		if err := json.Unmarshal(w.Body.Bytes(), &payment); err != nil {
			t.Fatal(err)
		}
		check(t, request("admin", "PUT", paymentPath+"/"+payment.ID, `{"date":"2026-01-01T00:00:00Z","amount":0.001}`), 400)
		w = request("viewer", "GET", base+"/cotisations", ``)
		check(t, w, 200)
		if err := json.Unmarshal(w.Body.Bytes(), &rows); err != nil {
			t.Fatal(err)
		}
		for _, row := range rows {
			if row.ID == targetID && (row.PaymentState != 4 || row.Remaining.String() != "-0.01") {
				t.Fatalf("one cent overpaid: %+v", row)
			}
		}
	})
	t.Run("empty draft and share edits refresh the per-share preview", func(t *testing.T) {
		budget, expense := newDraft(t)
		base := "/api/budget/" + budget.ID
		var unit models.Unit
		if err := conn.First(&unit, "number=3").Error; err != nil {
			t.Fatal(err)
		}
		unitPath := "/api/unit/" + unit.ID
		check(t, request("admin", "PUT", unitPath, `{"number":3,"address":"D","share":-1}`), 400)
		check(t, request("admin", "PUT", unitPath, `{"number":3,"address":"D","share":0}`), 200)
		defer conn.Model(&unit).Update("share", 1)
		var stored models.Unit
		if err := conn.First(&stored, "id=?", unit.ID).Error; err != nil || stored.Share != 0 {
			t.Fatalf("zero share not saved: %+v %v", stored, err)
		}
		result, err := controllers.GetBudget(conn, budget.ID)
		if err != nil || result.Preview.TotalShares != 2 || result.Preview.AnnualPerShare.String() != "150" || result.Preview.MonthlyPerShare.String() != "12.5" {
			t.Fatalf("updated shares preview: %+v %v", result, err)
		}
		check(t, request("admin", "DELETE", base+"/expenses/"+expense.ID, ``), 204)
		result, err = controllers.GetBudget(conn, budget.ID)
		if err != nil || !result.Amount.IsZero() || result.Preview.Ready {
			t.Fatalf("empty draft: %+v %v", result, err)
		}
		check(t, request("admin", "POST", base+"/publish", `{}`), 400)
		check(t, request("admin", "POST", base+"/expenses", `{"label":"New expense","amount":12}`), 201)
		result, err = controllers.GetBudget(conn, budget.ID)
		if err != nil || !result.Preview.Ready || result.Preview.AnnualPerShare.String() != "6" || result.Preview.MonthlyPerShare.String() != "0.5" {
			t.Fatalf("added expense preview: %+v %v", result, err)
		}
	})
	t.Run("draft deletion also hides draft expenses", func(t *testing.T) {
		budget, _ := newDraft(t)
		check(t, request("operator", "DELETE", "/api/budget/"+budget.ID, ``), 204)
		var count int64
		if err := conn.Model(&models.Expense{}).Where("budget_id = ?", budget.ID).Count(&count).Error; err != nil || count != 0 {
			t.Fatalf("draft expenses remain active: %d, %v", count, err)
		}
	})
	t.Run("two simultaneous publications produce one set of cotisations", func(t *testing.T) {
		budget, _ := newDraft(t)
		responses := make(chan *httptest.ResponseRecorder, 2)
		start := make(chan struct{})
		var workers sync.WaitGroup
		for i := 0; i < 2; i++ {
			workers.Add(1)
			go func() {
				defer workers.Done()
				<-start
				responses <- request("admin", "POST", "/api/budget/"+budget.ID+"/publish", `{}`)
			}()
		}
		close(start)
		workers.Wait()
		close(responses)
		var success, rejected int
		for w := range responses {
			if w.Code == 200 {
				success++
			} else if w.Code == 400 {
				rejected++
			} else {
				t.Fatalf("unexpected publication result: %d %s", w.Code, w.Body.String())
			}
		}
		if success != 1 || rejected != 1 {
			t.Fatalf("successes=%d, rejections=%d", success, rejected)
		}
		rows, err := controllers.ListCotisations(conn, budget.ID)
		if err != nil || len(rows) != 3 {
			t.Fatalf("duplicate cotisations: %v, %v", rows, err)
		}
	})
	t.Run("expense updates cannot race past publication", func(t *testing.T) {
		for i := 0; i < 4; i++ {
			budget, expense := newDraft(t)
			start := make(chan struct{})
			var update, publish *httptest.ResponseRecorder
			var workers sync.WaitGroup
			workers.Add(2)
			go func() {
				defer workers.Done()
				<-start
				update = request("admin", "PUT", "/api/budget/"+budget.ID+"/expenses/"+expense.ID, `{"label":"Concurrent update","amount":600}`)
			}()
			go func() {
				defer workers.Done()
				<-start
				publish = request("admin", "POST", "/api/budget/"+budget.ID+"/publish", `{}`)
			}()
			close(start)
			workers.Wait()
			check(t, publish, 200)
			if update.Code != 200 && update.Code != 403 {
				t.Fatalf("unexpected update: %d %s", update.Code, update.Body.String())
			}
			result, err := controllers.GetBudget(conn, budget.ID)
			if err != nil {
				t.Fatal(err)
			}
			rows, err := controllers.ListCotisations(conn, budget.ID)
			if err != nil {
				t.Fatal(err)
			}
			var sum money.Amount
			for _, row := range rows {
				sum = sum.Add(row.Amount)
			}
			if result.Draft || !result.Amount.Equal(sum) {
				t.Fatalf("financial mismatch after race: budget=%+v, cotisations=%s", result, sum)
			}
		}
	})
	t.Run("partial publication rolls back and can be retried", func(t *testing.T) {
		budget, _ := newDraft(t)
		if err := conn.Exec(`CREATE FUNCTION fail_second_cotisation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM public.cotisation WHERE budget_id=NEW.budget_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'simulated allocation failure'; END IF; RETURN NEW; END $$`).Error; err != nil {
			t.Fatal(err)
		}
		if err := conn.Exec(`CREATE TRIGGER fail_second_cotisation BEFORE INSERT ON public.cotisation FOR EACH ROW EXECUTE FUNCTION fail_second_cotisation()`).Error; err != nil {
			t.Fatal(err)
		}
		check(t, request("admin", "POST", "/api/budget/"+budget.ID+"/publish", `{}`), 500)
		result, err := controllers.GetBudget(conn, budget.ID)
		if err != nil || !result.Draft {
			t.Fatalf("failed publication changed budget: %+v, %v", result, err)
		}
		rows, err := controllers.ListCotisations(conn, budget.ID)
		if err != nil || len(rows) != 0 {
			t.Fatalf("partial cotisations persisted: %v, %v", rows, err)
		}
		if err := conn.Exec(`DROP TRIGGER fail_second_cotisation ON public.cotisation`).Error; err != nil {
			t.Fatal(err)
		}
		check(t, request("admin", "POST", "/api/budget/"+budget.ID+"/publish", `{}`), 200)
	})
	if pool.Stats().InUse != 0 {
		t.Fatal("budget errors retained database connections")
	}
}
