package mailings

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/mail"
	"sort"
	"strings"
)

type Member struct {
	ID     string
	Email  string
	Bureau bool
	Name   string
}
type InvalidMember struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Reason string `json:"reason"`
}
type ListPlan struct {
	Group        string   `json:"group"`
	Name         string   `json:"name"`
	Expected     []string `json:"expected"`
	Current      []string `json:"current"`
	Add          []string `json:"add"`
	Remove       []string `json:"remove"`
	PendingTasks []int64  `json:"pending_tasks"`
}
type Plan struct {
	Configured bool            `json:"configured"`
	Domain     string          `json:"domain"`
	Lists      []ListPlan      `json:"lists"`
	Invalid    []InvalidMember `json:"invalid"`
	Token      string          `json:"token"`
	CanApply   bool            `json:"can_apply"`
}
type Result struct {
	Plan     *Plan  `json:"plan"`
	Verified bool   `json:"verified"`
	Partial  bool   `json:"partial"`
	Message  string `json:"message"`
}

func Canonical(email string) (string, bool) {
	s := strings.TrimSpace(email)
	a, e := mail.ParseAddress(s)
	if e != nil || a.Address != s || !strings.Contains(s, "@") {
		return "", false
	}
	return strings.ToLower(s), true
}
func BuildPlan(cfg *Config, members []Member, current map[string][]string, pending ...map[string][]int64) *Plan {
	members = append([]Member(nil), members...)
	plan := &Plan{Configured: true, Domain: cfg.Domain, Lists: []ListPlan{}, Invalid: []InvalidMember{}}
	expected := map[string]map[string]bool{"membres": {}, "bureau": {}}
	for _, m := range members {
		email, ok := Canonical(m.Email)
		if !ok {
			plan.Invalid = append(plan.Invalid, InvalidMember{ID: m.ID, Name: m.Name, Reason: "E-mail absent ou invalide"})
			continue
		}
		expected["membres"][email] = true
		if m.Bureau {
			expected["bureau"][email] = true
		}
	}
	sort.Slice(plan.Invalid, func(i, j int) bool { return plan.Invalid[i].ID < plan.Invalid[j].ID })
	for _, group := range []string{"membres", "bureau"} {
		name := cfg.Members
		if group == "bureau" {
			name = cfg.Bureau
		}
		p := ListPlan{Group: group, Name: name, Expected: []string{}, Current: []string{}, Add: []string{}, Remove: []string{}}
		p.PendingTasks = []int64{}
		if len(pending) > 0 {
			p.PendingTasks = append(p.PendingTasks, pending[0][name]...)
		}
		sort.Slice(p.PendingTasks, func(i, j int) bool { return p.PendingTasks[i] < p.PendingTasks[j] })
		have := map[string]bool{}
		for _, email := range current[name] {
			normalized, ok := Canonical(email)
			if ok {
				have[normalized] = true
			}
			p.Current = append(p.Current, email)
			if !expected[group][normalized] {
				p.Remove = append(p.Remove, email)
			}
		}
		for email := range expected[group] {
			p.Expected = append(p.Expected, email)
			if !have[email] {
				p.Add = append(p.Add, email)
			}
		}
		sort.Strings(p.Expected)
		sort.Strings(p.Current)
		sort.Strings(p.Add)
		sort.Strings(p.Remove)
		plan.Lists = append(plan.Lists, p)
	}
	plan.CanApply = len(plan.Invalid) == 0
	changes := 0
	for _, list := range plan.Lists {
		changes += len(list.Add) + len(list.Remove)
		if len(list.PendingTasks) > 0 {
			plan.CanApply = false
		}
	}
	plan.CanApply = plan.CanApply && changes > 0
	// Hash includes the complete reviewed source/target state, without credentials.
	sort.Slice(members, func(i, j int) bool { return members[i].ID < members[j].ID })
	data, _ := json.Marshal(struct {
		Plan          *Plan
		Members       []Member
		Configuration *Config
	}{plan, members, cfg})
	sum := sha256.Sum256(data)
	plan.Token = hex.EncodeToString(sum[:])
	return plan
}
