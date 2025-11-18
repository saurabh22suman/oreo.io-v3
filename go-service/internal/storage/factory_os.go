package storage

import "os"

func realLookupEnv(key string) (string, bool) { return os.LookupEnv(key) }
