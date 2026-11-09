// Development-only state behind Smocker. This program never calls OVH or the
// application database. All subscribers are ephemeral and reset on restart.
package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"
)

type operation struct {
	ID                  int64  `json:"id"`
	State               string `json:"status"`
	list, email, method string
	ready               time.Time
}

type fixture struct {
	mu    sync.Mutex
	lists map[string][]string
	tasks []operation
	next  int64
	delay time.Duration
}

func newFixture(delay time.Duration) *fixture {
	return &fixture{lists: map[string][]string{
		"membres": {"ancien-membre@example.invalid"},
		"bureau":  {"ancien-bureau@example.invalid"},
	}, delay: delay}
}

func (f *fixture) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method == http.MethodGet && r.URL.Path == "/health" {
		json.NewEncoder(w).Encode(map[string]bool{"ready": true})
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	remaining := f.tasks[:0]
	for _, task := range f.tasks {
		if time.Now().Before(task.ready) {
			remaining = append(remaining, task)
			continue
		}
		if task.method == http.MethodPost && !slices.Contains(f.lists[task.list], task.email) {
			f.lists[task.list] = append(f.lists[task.list], task.email)
		} else if task.method == http.MethodDelete {
			f.lists[task.list] = slices.DeleteFunc(f.lists[task.list], func(email string) bool { return email == task.email })
		}
	}
	f.tasks = remaining
	const base = "/email/domain/example.invalid/"
	if r.Method == http.MethodGet && r.URL.Path == base+"task/mailinglist" {
		list := r.URL.Query().Get("account")
		if _, ok := f.lists[list]; !ok {
			http.Error(w, `{"message":"Unknown fixture list"}`, http.StatusNotFound)
			return
		}
		ids := []int64{}
		for _, task := range f.tasks {
			if task.list == list {
				ids = append(ids, task.ID)
			}
		}
		json.NewEncoder(w).Encode(ids)
		return
	}
	path := strings.TrimPrefix(r.URL.Path, base+"mailingList/")
	parts := strings.Split(path, "/")
	if path == r.URL.Path || len(parts) < 2 || len(parts) > 3 || parts[1] != "subscriber" {
		http.NotFound(w, r)
		return
	}
	list := parts[0]
	if _, ok := f.lists[list]; !ok {
		http.NotFound(w, r)
		return
	}
	if r.Method == http.MethodGet && len(parts) == 2 {
		result := append([]string{}, f.lists[list]...)
		slices.Sort(result)
		json.NewEncoder(w).Encode(result)
		return
	}
	var email string
	if r.Method == http.MethodPost && len(parts) == 2 {
		var body struct {
			Email string `json:"email"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil || body.Email == "" {
			http.Error(w, `{"message":"Missing fixture email"}`, http.StatusBadRequest)
			return
		}
		email = body.Email
	} else if r.Method == http.MethodDelete && len(parts) == 3 && parts[2] != "" {
		email = parts[2]
	} else {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	f.next++
	task := operation{ID: f.next, State: "todo", list: list, email: email, method: r.Method, ready: time.Now().Add(f.delay)}
	f.tasks = append(f.tasks, task)
	json.NewEncoder(w).Encode(task)
}

func main() {
	listen := flag.String("listen", ":8182", "development fixture listen address")
	delay := flag.Duration("delay", time.Second, "simulated asynchronous task delay")
	flag.Parse()
	server := &http.Server{Addr: *listen, Handler: newFixture(*delay), ReadHeaderTimeout: 5 * time.Second}
	log.Fatal(server.ListenAndServe())
}
