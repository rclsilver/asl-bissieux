package cmd

import (
	"context"
	"encoding/json"
	"time"

	"github.com/rclsilver/asl-bissieux/controllers"
	"github.com/rclsilver/asl-bissieux/pkg/db"
	"github.com/spf13/cobra"
)

// A read-only operator check: prints counts, never credentials or subscriber
// addresses. Applying changes remains an authenticated administrative action.
func init() {
	command := &cobra.Command{Use: "mailing-lists", Short: "Inspect configured OVH mailing lists"}
	command.AddCommand(&cobra.Command{Use: "check", Short: "Read OVH and compare membership without changing subscribers", Args: cobra.NoArgs, RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := context.WithTimeout(cmd.Context(), 45*time.Second)
		defer cancel()
		conn, err := db.Open(ctx)
		if err != nil {
			return err
		}
		pool, _ := conn.DB()
		defer pool.Close()
		if err := db.CheckCurrent(ctx, conn); err != nil {
			return err
		}
		plan, err := controllers.PreviewMailingLists(conn)
		if err != nil {
			return err
		}
		type list struct {
			Group    string `json:"group"`
			Expected int    `json:"expected"`
			Current  int    `json:"current"`
			Add      int    `json:"add"`
			Remove   int    `json:"remove"`
			Pending  int    `json:"pending"`
		}
		summary := struct {
			Configured bool   `json:"configured"`
			Verified   bool   `json:"verified"`
			Invalid    int    `json:"invalid_members"`
			Lists      []list `json:"lists"`
		}{Configured: plan.Configured, Verified: plan.Configured && len(plan.Invalid) == 0, Invalid: len(plan.Invalid), Lists: []list{}}
		for _, p := range plan.Lists {
			summary.Lists = append(summary.Lists, list{p.Group, len(p.Expected), len(p.Current), len(p.Add), len(p.Remove), len(p.PendingTasks)})
			if len(p.Add)+len(p.Remove)+len(p.PendingTasks) > 0 {
				summary.Verified = false
			}
		}
		return json.NewEncoder(cmd.OutOrStdout()).Encode(summary)
	}})
	rootCmd.AddCommand(command)
}
