package controllers

import (
	"math"
	"testing"

	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/money"
)

func TestExactAllocation(t *testing.T) {
	for _, tc := range []struct {
		amount   string
		shares   []int
		expected map[int]string
	}{
		{"100", []int{1, 1, 1}, map[int]string{1: "33.34", 2: "33.33", 3: "33.33"}},
		{"0.01", []int{1, 1, 1}, map[int]string{1: "0.01", 2: "0", 3: "0"}},
		{"0.02", []int{1, 2, 3}, map[int]string{1: "0", 2: "0.01", 3: "0.01"}},
		{"10.01", []int{1, 0, 2}, map[int]string{1: "3.34", 3: "6.67"}},
		{"0.30", []int{1, 2}, map[int]string{1: "0.1", 2: "0.2"}},
		{"9999999999.99", []int{math.MaxInt32, math.MaxInt32}, map[int]string{1: "5000000000", 2: "4999999999.99"}},
	} {
		t.Run(tc.amount, func(t *testing.T) {
			var units []*models.Unit
			// Deliberately reverse input order to exercise deterministic ties.
			for i := len(tc.shares) - 1; i >= 0; i-- {
				units = append(units, models.NewUnit(i+1, "test", tc.shares[i]))
			}
			allocations, err := Allocate(money.MustParse(tc.amount), units)
			if err != nil {
				t.Fatal(err)
			}
			if len(allocations) != len(tc.expected) {
				t.Fatalf("allocations=%d", len(allocations))
			}
			var sum money.Amount
			for _, a := range allocations {
				if a.Amount.String() != tc.expected[a.Unit.Number] {
					t.Fatalf("unit %d: got %s, want %s", a.Unit.Number, a.Amount, tc.expected[a.Unit.Number])
				}
				sum = sum.Add(a.Amount)
			}
			if !sum.Equal(money.MustParse(tc.amount)) {
				t.Fatalf("sum %s != %s", sum, tc.amount)
			}
		})
	}
	for _, shares := range [][]int{nil, {0, 0}, {1, -1}, {math.MaxInt64, 1}} {
		var units []*models.Unit
		for i, share := range shares {
			units = append(units, models.NewUnit(i+1, "test", share))
		}
		if _, err := Allocate(money.Euros(100), units); err == nil {
			t.Fatalf("accepted invalid shares %v", shares)
		}
	}
	if _, err := Allocate(money.MustParse("100.001"), []*models.Unit{models.NewUnit(1, "test", 1)}); err == nil {
		t.Fatal("fractional budget published")
	}
}

func TestPreviewRates(t *testing.T) {
	units := []*models.Unit{models.NewUnit(1, "test", 1), models.NewUnit(2, "test", 2)}
	p := BudgetPreview(money.Euros(120), units)
	if !p.Ready || p.TotalShares != 3 || p.Months != 12 || p.AnnualPerShare.String() != "40" || p.MonthlyPerShare.String() != "3.333333" {
		t.Fatalf("preview %+v", p)
	}
	for _, amount := range []string{"0", "1.001"} {
		if p := BudgetPreview(money.MustParse(amount), units); p.Ready || p.Message == "" {
			t.Fatalf("invalid preview %+v", p)
		}
	}
	if p := BudgetPreview(money.Euros(120), nil); p.Ready || p.TotalShares != 0 || p.Message == "" {
		t.Fatalf("zero shares preview %+v", p)
	}
}
