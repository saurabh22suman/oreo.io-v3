package storage

// EnvLookupForTest overrides env lookup used by GetAdapterForDataset for tests.
// Pass empty string to reset to real environment lookup.
func EnvLookupForTest(value string) {
    if value == "" {
        envLookup = func(key string) (string, bool) { return defaultEnvLookup(key) }
        return
    }
    envLookup = func(key string) (string, bool) { return value, true }
}
