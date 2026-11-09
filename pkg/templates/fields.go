package templates

import (
	"sort"
	"strings"
	"text/template"
	"text/template/parse"

	"github.com/Masterminds/sprig/v3"
)

type CustomField struct {
	Name    string `json:"name"`
	Complex bool   `json:"complex"`
}
type FieldDescription struct {
	Fields   []CustomField `json:"fields"`
	Advanced bool          `json:"advanced"`
}
type fieldScope struct {
	dot  []string // nil: unknown context; non-nil empty: root context
	vars map[string][]string
}

func (s fieldScope) child(dot []string) fieldScope {
	vars := make(map[string][]string, len(s.vars))
	for name, path := range s.vars {
		vars[name] = path
	}
	return fieldScope{dot: dot, vars: vars}
}
func fieldPath(node parse.Node, s fieldScope) []string {
	var base, tail []string
	switch n := node.(type) {
	case *parse.DotNode:
		return s.dot
	case *parse.FieldNode:
		base = s.dot
		tail = n.Ident
	case *parse.VariableNode:
		base = s.vars[n.Ident[0]]
		tail = n.Ident[1:]
	case *parse.ChainNode:
		base = fieldPath(n.Node, s)
		tail = n.Field
	case *parse.PipeNode:
		if n != nil && len(n.Cmds) == 1 {
			return fieldPath(n.Cmds[0], s)
		}
		return nil
	case *parse.CommandNode:
		if len(n.Args) == 1 {
			return fieldPath(n.Args[0], s)
		}
		if len(n.Args) >= 3 {
			if fn, ok := n.Args[0].(*parse.IdentifierNode); ok && (fn.Ident == "index" || fn.Ident == "get") {
				base = fieldPath(n.Args[1], s)
				for _, arg := range n.Args[2:] {
					key, ok := arg.(*parse.StringNode)
					if !ok {
						return nil
					}
					tail = append(tail, key.Text)
				}
				break
			}
		}
		return nil
	default:
		return nil
	}
	if base == nil {
		return nil
	}
	return append(append([]string{}, base...), tail...)
}

// DescribeFields parses the same Go/Sprig syntax as rendering without executing
// it. Root references, aliases and local range/with contexts retain their scope.
func DescribeFields(formats ...string) FieldDescription {
	result := FieldDescription{Fields: []CustomField{}}
	found := map[string]bool{}
	automatic := map[string]bool{"member": true, "budget": true, "amount": true, "cotisations": true, "expenses": true}
	add := func(path []string, complex bool) {
		if len(path) > 0 && (path[0] == "" || strings.TrimSpace(path[0]) != path[0]) {
			result.Advanced = true
			return
		}
		if len(path) > 0 && !automatic[path[0]] {
			found[path[0]] = found[path[0]] || complex || len(path) > 1
		}
	}
	for _, format := range formats {
		tmpl, err := template.New("").Funcs(sprig.TxtFuncMap()).Parse(format)
		if err != nil {
			result.Advanced = true
			continue
		}
		visited := map[string]bool{}
		var walk func(parse.Node, fieldScope)
		walk = func(node parse.Node, s fieldScope) {
			if node == nil {
				return
			}
			switch n := node.(type) {
			case *parse.ListNode:
				if n != nil {
					for _, child := range n.Nodes {
						walk(child, s)
					}
				}
			case *parse.ActionNode:
				walk(n.Pipe, s)
			case *parse.PipeNode:
				if n == nil {
					return
				}
				for _, cmd := range n.Cmds {
					walk(cmd, s)
				}
				if len(n.Decl) == 1 {
					s.vars[n.Decl[0].Ident[0]] = fieldPath(n, s)
				}
			case *parse.CommandNode:
				if len(n.Args) > 1 {
					fn, _ := n.Args[0].(*parse.IdentifierNode)
					if fn != nil && fn.Ident != "index" && fn.Ident != "get" {
						for _, arg := range n.Args[1:] {
							if p := fieldPath(arg, s); p != nil && len(p) == 0 {
								result.Advanced = true
							}
						}
					}
				}
				if len(n.Args) >= 3 {
					if fn, ok := n.Args[0].(*parse.IdentifierNode); ok && (fn.Ident == "index" || fn.Ident == "get") {
						p := fieldPath(n, s)
						add(fieldPath(n.Args[1], s), true)
						if p == nil {
							result.Advanced = true
						} else {
							add(p, false)
						}
					}
				}
				for _, arg := range n.Args {
					walk(arg, s)
				}
			case *parse.FieldNode, *parse.VariableNode, *parse.ChainNode:
				add(fieldPath(node, s), false)
				if chain, ok := node.(*parse.ChainNode); ok {
					walk(chain.Node, s)
				}
			case *parse.IfNode:
				local := s.child(s.dot)
				walk(n.Pipe, local)
				walk(n.List, local.child(s.dot))
				walk(n.ElseList, local.child(s.dot))
			case *parse.RangeNode:
				local := s.child(s.dot)
				walk(n.Pipe, local)
				p := fieldPath(n.Pipe, s)
				add(p, true)
				var element []string
				if p != nil {
					element = append(append([]string{}, p...), "[]")
				}
				if p == nil {
					result.Advanced = true
				}
				body := local.child(element)
				for i, decl := range n.Pipe.Decl {
					if i == len(n.Pipe.Decl)-1 {
						body.vars[decl.Ident[0]] = element
					} else {
						body.vars[decl.Ident[0]] = nil
					}
				}
				walk(n.List, body)
				walk(n.ElseList, local.child(s.dot))
			case *parse.WithNode:
				local := s.child(s.dot)
				walk(n.Pipe, local)
				p := fieldPath(n.Pipe, s)
				if p == nil {
					result.Advanced = true
				}
				walk(n.List, local.child(p))
				walk(n.ElseList, local.child(s.dot))
			case *parse.TemplateNode:
				walk(n.Pipe, s)
				p := fieldPath(n.Pipe, s)
				if p == nil {
					result.Advanced = true
				}
				key := n.Name + "/unknown"
				if p != nil {
					key = n.Name + "/" + strings.Join(p, ".")
				}
				if len(p) > 0 {
					key = n.Name + "/" + p[0]
				}
				if !visited[key] {
					visited[key] = true
					if child := tmpl.Lookup(n.Name); child != nil && child.Tree != nil {
						walk(child.Tree.Root, fieldScope{dot: p, vars: map[string][]string{"$": p}})
					} else {
						result.Advanced = true
					}
				}
			}
		}
		walk(tmpl.Tree.Root, fieldScope{dot: []string{}, vars: map[string][]string{"$": {}}})
	}
	for name, complex := range found {
		result.Fields = append(result.Fields, CustomField{Name: name, Complex: complex})
	}
	sort.Slice(result.Fields, func(i, j int) bool { return result.Fields[i].Name < result.Fields[j].Name })
	return result
}
