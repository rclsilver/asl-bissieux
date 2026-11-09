package controllers

import (
	"fmt"
	"math"
	"math/big"
	"sort"

	"github.com/rclsilver/asl-bissieux/models"
	"github.com/rclsilver/asl-bissieux/pkg/money"
	"github.com/shopspring/decimal"
)

func TotalShares(units []*models.Unit) (int64, error) {
	var total int64
	for _, unit := range units {
		if unit.Share < 0 {
			return 0, fmt.Errorf("Le lot %d comporte des parts négatives : corrigez-les avant publication.", unit.Number)
		}
		if int64(unit.Share) > math.MaxInt64-total {
			return 0, fmt.Errorf("Le total des parts dépasse la limite autorisée.")
		}
		total += int64(unit.Share)
	}
	if total == 0 {
		return 0, fmt.Errorf("La publication nécessite des lots avec un total de parts positif.")
	}
	return total, nil
}

type Allocation struct {
	Unit   *models.Unit
	Amount money.Amount
}

// Allocate uses integer arithmetic throughout, including product and remainder.
// Largest remainders win the remaining cents; ties use unit number then ID.
func Allocate(amount money.Amount, units []*models.Unit) ([]Allocation, error) {
	if err := amount.ValidateInput(); err != nil {
		return nil, err
	}
	shares, err := TotalShares(units)
	if err != nil {
		return nil, err
	}
	totalCents := amount.Shift(2).IntPart()
	denominator := big.NewInt(shares)
	type portion struct {
		allocation Allocation
		cents      int64
		remainder  *big.Int
	}
	portions := make([]portion, 0, len(units))
	remaining := totalCents
	for _, unit := range units {
		if unit.Share == 0 {
			continue
		}
		product := new(big.Int).Mul(big.NewInt(totalCents), big.NewInt(int64(unit.Share)))
		quotient, remainder := new(big.Int), new(big.Int)
		quotient.QuoRem(product, denominator, remainder)
		cents := quotient.Int64()
		remaining -= cents
		portions = append(portions, portion{Allocation{Unit: unit}, cents, remainder})
	}
	sort.Slice(portions, func(i, j int) bool {
		if cmp := portions[i].remainder.Cmp(portions[j].remainder); cmp != 0 {
			return cmp > 0
		}
		if portions[i].allocation.Unit.Number != portions[j].allocation.Unit.Number {
			return portions[i].allocation.Unit.Number < portions[j].allocation.Unit.Number
		}
		return portions[i].allocation.Unit.ID < portions[j].allocation.Unit.ID
	})
	result := make([]Allocation, len(portions))
	for i := range portions {
		if int64(i) < remaining {
			portions[i].cents++
		}
		result[i] = portions[i].allocation
		result[i].Amount = money.Cents(portions[i].cents)
	}
	return result, nil
}

func BudgetPreview(amount money.Amount, units []*models.Unit) *models.BudgetPreview {
	p := &models.BudgetPreview{Amount: amount, Months: 12}
	shares, err := TotalShares(units)
	if err != nil {
		p.Message = err.Error()
		return p
	}
	p.TotalShares = shares
	denominator := decimal.NewFromInt(shares)
	p.AnnualPerShare = money.Of(amount.DivRound(denominator, 6))
	p.MonthlyPerShare = money.Of(amount.DivRound(denominator.Mul(decimal.NewFromInt(12)), 6))
	if err := amount.ValidateInput(); err != nil {
		p.Message = "Ajoutez des dépenses positives au centime avant publication."
		return p
	}
	p.Ready = true
	return p
}
