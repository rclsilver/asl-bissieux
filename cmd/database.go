package cmd

import (
	"context"
	"fmt"
	"time"

	"github.com/rclsilver/asl-bissieux/pkg/db"
	"github.com/spf13/cobra"
)

func init() {
	database := &cobra.Command{Use: "database", Short: "Inspect and manage versioned database migrations"}
	for _, name := range []string{"status", "baseline", "migrate"} {
		operation := name
		database.AddCommand(&cobra.Command{
			Use: operation, Args: cobra.NoArgs,
			RunE: func(cmd *cobra.Command, args []string) error {
				ctx, cancel := context.WithTimeout(cmd.Context(), 2*time.Minute)
				defer cancel()
				conn, err := db.Open(ctx)
				if err != nil {
					return err
				}
				pool, _ := conn.DB()
				defer pool.Close()
				switch operation {
				case "baseline":
					if err := db.Baseline(ctx, conn); err != nil {
						return err
					}
				case "migrate":
					if err := db.Migrate(ctx, conn); err != nil {
						return err
					}
				}
				status, err := db.MigrationStatus(ctx, conn)
				if err != nil {
					return err
				}
				if status.NeedsBaseline {
					fmt.Fprintln(cmd.OutOrStdout(), "Existing database requires baseline adoption before migration.")
				}
				for _, info := range status.Migrations {
					state := "pending"
					if info.Applied {
						state = "applied"
					}
					fmt.Fprintf(cmd.OutOrStdout(), "%04d %s %s\n", info.Version, info.Name, state)
				}
				return nil
			},
		})
	}
	rootCmd.AddCommand(database)
}
