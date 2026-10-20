package server

import (
	"bytes"
	"encoding/json"
	"github.com/google/uuid"
	"github.com/rclsilver/asl-bissieux/controllers"
	"github.com/rclsilver/asl-bissieux/internal/testdb"
	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/auth"
	"github.com/rclsilver/asl-bissieux/pkg/money"
	"github.com/rclsilver/asl-bissieux/server/handlers"
	"net/http/httptest"
	"testing"
	"time"
)

func TestFinancialHTTP(t *testing.T) {
	conn, _ := testdb.Open(t)
	users := map[string]*auth.User{"admin": auth.NewUser("admin@example.invalid", true, true, nil), "refund": auth.NewUser("refund@example.invalid", true, false, []string{handlers.CreateRefundAction}), "viewer": auth.NewUser("viewer@example.invalid", true, false, nil), "disabled": auth.NewUser("disabled@example.invalid", false, true, nil)}
	for _, u := range users {
		if err := conn.Create(u).Error; err != nil {
			t.Fatal(err)
		}
	}
	b := models.NewBudget("HTTP ledger fixture")
	lot := models.NewUnit(1, "Fixture", 1)
	conn.Create(b)
	conn.Create(lot)
	conn.Model(b).Update("draft", false)
	c := models.NewCotisation(b.ID, lot.ID, money.Euros(100))
	conn.Create(c)
	p := models.NewPayment(c.ID, users["admin"].ID, time.Now(), money.Euros(150), "Fixture")
	conn.Create(p)
	app := NewServer().WithAuthProvider(&budgetTestProvider{users: users})
	if err := app.Build(); err != nil {
		t.Fatal(err)
	}
	path := "/api/budget/" + b.ID + "/cotisations/" + c.ID
	request := func(role, method, path string, body any) *httptest.ResponseRecorder {
		encoded, _ := json.Marshal(body)
		r := httptest.NewRequest(method, path, bytes.NewReader(encoded))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("X-Test-Role", role)
		w := httptest.NewRecorder()
		app.apiRouter.ServeHTTP(w, r)
		return w
	}
	check := func(w *httptest.ResponseRecorder, status int) {
		t.Helper()
		if w.Code != status {
			t.Fatalf("HTTP %d expected %d: %s", w.Code, status, w.Body.String())
		}
	}
	in := controllers.FinancialInput{ID: uuid.NewString(), Kind: "refund", Amount: money.Euros(50), Date: "2026-10-21", Reason: "Fixture"}
	for _, role := range []string{"viewer", "disabled", ""} {
		status := 403
		if role != "viewer" {
			status = 401
		}
		check(request(role, "POST", path+"/entries/preview", in), status)
		check(request(role, "POST", path+"/entries", in), status)
	}
	w := request("refund", "POST", path+"/entries/preview", in)
	check(w, 200)
	var preview models.FinancialPreview
	if err := json.Unmarshal(w.Body.Bytes(), &preview); err != nil {
		t.Fatal(err)
	}
	in.Version = preview.Version
	check(request("refund", "POST", path+"/entries", in), 201)
	check(request("admin", "DELETE", path+"/payments/"+p.ID, nil), 400)
	payment := map[string]any{"date": "2026-10-21T00:00:00Z", "amount": 49, "comment": "Cannot reduce below refund"}
	check(request("admin", "PUT", path+"/payments/"+p.ID, payment), 400)
	in.Kind = "adjustment"
	in.Amount = money.Euros(1)
	check(request("refund", "POST", path+"/entries/preview", in), 403)
	check(request("viewer", "GET", path+"/entries", nil), 200)
	check(request("admin", "GET", "/api/budget/"+uuid.NewString()+"/cotisations/"+c.ID+"/entries", nil), 404)
}
