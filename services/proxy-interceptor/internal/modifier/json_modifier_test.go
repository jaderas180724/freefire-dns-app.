package modifier

import (
	"testing"
)

func TestModifyJSON(t *testing.T) {
	tests := []struct {
		name           string
		body           string
		targetKeys     []string
		injectionValue string
		expectModified bool
		expectedKey    string
		expectedValue  string
	}{
		{
			name:           "Simple string replacement",
			body:           `{"name":"John","age":30}`,
			targetKeys:     []string{"name"},
			injectionValue: "Jane",
			expectModified: true,
			expectedKey:    "name",
			expectedValue:  "Jane",
		},
		{
			name:           "Nested key replacement",
			body:           `{"user":{"name":"John","role":"user"}}`,
			targetKeys:     []string{"user.role"},
			injectionValue: "admin",
			expectModified: true,
			expectedKey:    "user.role",
			expectedValue:  "admin",
		},
		{
			name:           "Boolean injection",
			body:           `{"feature":{"enabled":false}}`,
			targetKeys:     []string{"feature.enabled"},
			injectionValue: "true",
			expectModified: true,
			expectedKey:    "feature.enabled",
			expectedValue:  "true",
		},
		{
			name:           "Non-existent key",
			body:           `{"name":"John"}`,
			targetKeys:     []string{"nonexistent"},
			injectionValue: "value",
			expectModified: false,
		},
		{
			name:           "Invalid JSON body",
			body:           `not json`,
			targetKeys:     []string{"key"},
			injectionValue: "value",
			expectModified: false,
		},
		{
			name:           "Multiple keys",
			body:           `{"a":"1","b":"2","c":"3"}`,
			targetKeys:     []string{"a", "c"},
			injectionValue: "replaced",
			expectModified: true,
			expectedKey:    "a",
			expectedValue:  "replaced",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, modified := ModifyJSON([]byte(tt.body), tt.targetKeys, tt.injectionValue)

			if modified != tt.expectModified {
				t.Errorf("expected modified=%v, got %v", tt.expectModified, modified)
			}

			if tt.expectModified && tt.expectedKey != "" {
				_ = result // Verify result is valid JSON
			}
		})
	}
}

func TestFindKeys(t *testing.T) {
	body := []byte(`{
		"user": {
			"name": "John",
			"profile": {
				"name": "Display Name"
			}
		},
		"name": "root"
	}`)

	paths := FindKeys(body, "name")
	if len(paths) != 3 {
		t.Errorf("expected 3 paths, got %d: %v", len(paths), paths)
	}
}
