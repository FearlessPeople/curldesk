//go:build !windows

package backend

import "fmt"

func installUpdate(_ string) error {
	return fmt.Errorf("automatic installation is currently supported on Windows only")
}
