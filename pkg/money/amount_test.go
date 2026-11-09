package money

import (
	"encoding/json"
	"testing"
)

func TestAmounts(t *testing.T) {
	for _, s := range []string{"0.01", "1.10", "100", "1e2", "9999999999.99"} {
		var a Amount
		if err := json.Unmarshal([]byte(s), &a); err != nil {
			t.Fatalf("%s: %v", s, err)
		}
		if err := a.ValidateInput(); err != nil {
			t.Fatalf("%s: %v", s, err)
		}
		encoded, err := json.Marshal(a)
		if err != nil || len(encoded) == 0 || encoded[0] == '"' {
			t.Fatalf("not a JSON number: %s, %v", encoded, err)
		}
		var roundtrip Amount
		if err := json.Unmarshal(encoded, &roundtrip); err != nil || !a.Equal(roundtrip) {
			t.Fatalf("round trip %s: %v", s, err)
		}
	}
	for _, s := range []string{"0", "-1", "0.001", "1.234", "10000000000", "null", `"1.23"`, "1e999999999", "1e-999999999"} {
		var a Amount
		if err := json.Unmarshal([]byte(s), &a); err == nil && a.ValidateInput() == nil {
			t.Fatalf("accepted %s", s)
		}
	}
	if !MustParse("0.1").Add(MustParse("0.2")).Equal(MustParse("0.3")) {
		t.Fatal("decimal sum is not exact")
	}
	var historical Amount
	if err := historical.Scan("33.33333333333333333333"); err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(historical)
	if err != nil || string(encoded) != "33.33333333333333333333" {
		t.Fatalf("historical fraction lost: %s %v", encoded, err)
	}
	if err := historical.ValidateInput(); err == nil {
		t.Fatal("historical fractions should require correction before a new financial write")
	}
}
