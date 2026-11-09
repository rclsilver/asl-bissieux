package mailings

import (
	"context"
	"net/url"
	"time"

	"github.com/ovh/go-ovh/ovh"
)

type Provider interface {
	Subscribers(context.Context, string) ([]string, error)
	Pending(context.Context, string) ([]int64, error)
	Add(context.Context, string, string) error
	Remove(context.Context, string, string) error
}
type Client struct {
	api         *ovh.Client
	domain      string
	bureau      string
	redirection bool
}

func NewClient(cfg *Config) (*Client, error) {
	var api *ovh.Client
	var err error
	if cfg.UsesOAuth2() {
		api, err = ovh.NewOAuth2Client(cfg.Endpoint, cfg.ClientID, cfg.ClientSecret)
	} else {
		api, err = ovh.NewClient(cfg.Endpoint, cfg.ApplicationKey, cfg.ApplicationSecret, cfg.ConsumerKey)
	}
	if err != nil {
		return nil, err
	}
	api.Timeout = 15 * time.Second
	return &Client{api: api, domain: cfg.Domain, bureau: cfg.Bureau, redirection: cfg.UsesRedirection()}, nil
}
func (c *Client) path(list string) string {
	return "/email/domain/" + url.PathEscape(c.domain) + "/mailingList/" + url.PathEscape(list) + "/subscriber"
}

// The Bureau group may be held as email redirections (one bureau@domain
// redirection per recipient) instead of a mailing list.
func (c *Client) redirected(list string) bool { return c.redirection && list == c.bureau }
func (c *Client) redirectionPath() string {
	return "/email/domain/" + url.PathEscape(c.domain) + "/redirection"
}
func (c *Client) redirectionIDs(ctx context.Context, list, to string) ([]string, error) {
	query := "?from=" + url.QueryEscape(list+"@"+c.domain)
	if to != "" {
		query += "&to=" + url.QueryEscape(to)
	}
	var ids []string
	err := c.api.GetWithContext(ctx, c.redirectionPath()+query, &ids)
	return ids, err
}
func (c *Client) Subscribers(ctx context.Context, list string) ([]string, error) {
	var result []string
	if c.redirected(list) {
		ids, err := c.redirectionIDs(ctx, list, "")
		if err != nil {
			return nil, err
		}
		for _, id := range ids {
			var redirection struct {
				To string `json:"to"`
			}
			if err := c.api.GetWithContext(ctx, c.redirectionPath()+"/"+url.PathEscape(id), &redirection); err != nil {
				return nil, err
			}
			result = append(result, redirection.To)
		}
		return result, nil
	}
	err := c.api.GetWithContext(ctx, c.path(list), &result)
	return result, err
}
func (c *Client) Add(ctx context.Context, list, email string) error {
	var task map[string]any
	if c.redirected(list) {
		return c.api.PostWithContext(ctx, c.redirectionPath(), map[string]any{"from": list + "@" + c.domain, "to": email, "localCopy": false}, &task)
	}
	return c.api.PostWithContext(ctx, c.path(list), map[string]string{"email": email}, &task)
}
func (c *Client) Remove(ctx context.Context, list, email string) error {
	var task map[string]any
	if c.redirected(list) {
		ids, err := c.redirectionIDs(ctx, list, email)
		if err != nil {
			return err
		}
		for _, id := range ids {
			if err := c.api.DeleteWithContext(ctx, c.redirectionPath()+"/"+url.PathEscape(id), &task); err != nil {
				return err
			}
		}
		return nil
	}
	return c.api.DeleteWithContext(ctx, c.path(list)+"/"+url.PathEscape(email), &task)
}

// Mailing-list tasks are queued by OVH. Never enqueue the same difference while
// a prior task for that list is still present.
func (c *Client) Pending(ctx context.Context, list string) ([]int64, error) {
	var ids []int64
	kind := "mailinglist"
	if c.redirected(list) {
		kind = "redirection"
	}
	err := c.api.GetWithContext(ctx, "/email/domain/"+url.PathEscape(c.domain)+"/task/"+kind+"?account="+url.QueryEscape(list), &ids)
	return ids, err
}
