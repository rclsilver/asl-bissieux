// Package money keeps monetary values decimal from PostgreSQL to JSON. Historical
// fractions remain exact; only new financial writes must pass ValidateInput.
package money

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/shopspring/decimal"
)

type Amount struct{ decimal.Decimal }

func Euros(n int64) Amount        { return Amount{decimal.NewFromInt(n)} }
func Cents(n int64) Amount        { return Amount{decimal.New(n, -2)} }
func Of(d decimal.Decimal) Amount { return Amount{d} }

func MustParse(s string) Amount { return Amount{decimal.RequireFromString(s)} }

func (Amount) GormDataType() string           { return "numeric" }
func (a Amount) Add(b Amount) Amount          { return Of(a.Decimal.Add(b.Decimal)) }
func (a Amount) Equal(b Amount) bool          { return a.Decimal.Equal(b.Decimal) }
func (a Amount) Cmp(b Amount) int             { return a.Decimal.Cmp(b.Decimal) }
func (a Amount) MarshalJSON() ([]byte, error) { return []byte(a.String()), nil }

var jsonNumber = regexp.MustCompile(`^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$`)

// Bound exponents before parsing to avoid allocating huge decimal coefficients
// from a hostile JSON number. PostgreSQL scans do not go through this method.
func (a *Amount) UnmarshalJSON(data []byte) error {
	data = bytes.TrimSpace(data)
	if len(data) > 64 || !jsonNumber.Match(data) {
		return fmt.Errorf("Le montant doit être un nombre.")
	}
	if i := strings.IndexAny(string(data), "eE"); i >= 0 {
		exponent, err := strconv.Atoi(string(data[i+1:]))
		if err != nil || exponent < -20 || exponent > 20 {
			return fmt.Errorf("Exposant du montant hors limites.")
		}
	}
	var d decimal.Decimal
	if err := json.Unmarshal(data, &d); err != nil {
		return err
	}
	if d.Abs().GreaterThan(decimal.RequireFromString("9999999999.99")) {
		return fmt.Errorf("Le montant dépasse 9 999 999 999,99 €.")
	}
	a.Decimal = d
	return nil
}

func (a Amount) ValidateInput() error {
	if !a.IsPositive() || a.GreaterThan(decimal.RequireFromString("9999999999.99")) {
		return fmt.Errorf("Le montant doit être compris entre 0,01 € et 9 999 999 999,99 €.")
	}
	if !a.Decimal.Equal(a.Round(2)) {
		return fmt.Errorf("Le montant doit comporter au plus deux décimales.")
	}
	return nil
}
