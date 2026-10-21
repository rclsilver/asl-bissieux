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
	api    *ovh.Client
	domain string
}

func NewClient(cfg *Config) (*Client, error) {
	api, err := ovh.NewClient(cfg.Endpoint, cfg.ApplicationKey, cfg.ApplicationSecret, cfg.ConsumerKey)
	if err != nil {
		return nil, err
	}
	api.Timeout = 15 * time.Second
	return &Client{api: api, domain: cfg.Domain}, nil
}
func (c *Client) path(list string) string {
	return "/email/domain/" + url.PathEscape(c.domain) + "/mailingList/" + url.PathEscape(list) + "/subscriber"
}
func (c *Client) Subscribers(ctx context.Context, list string) ([]string, error) {
	var result []string
	err := c.api.GetWithContext(ctx, c.path(list), &result)
	return result, err
}
func (c *Client) Add(ctx context.Context, list, email string) error {
	var task map[string]any
	return c.api.PostWithContext(ctx, c.path(list), map[string]string{"email": email}, &task)
}
func (c *Client) Remove(ctx context.Context, list, email string) error {
	var task map[string]any
	return c.api.DeleteWithContext(ctx, c.path(list)+"/"+url.PathEscape(email), &task)
}

// Mailing-list tasks are queued by OVH. Never enqueue the same difference while
// a prior task for that list is still present.
func (c *Client) Pending(ctx context.Context, list string) ([]int64, error) {
	var ids []int64
	err := c.api.GetWithContext(ctx, "/email/domain/"+url.PathEscape(c.domain)+"/task/mailinglist?account="+url.QueryEscape(list), &ids)
	return ids, err
}
