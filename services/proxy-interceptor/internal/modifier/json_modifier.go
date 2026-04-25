package modifier

import (
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// ModifyJSON takes a JSON body, a list of target key paths, and an injection value.
// It replaces the value at each target key path with the injection value.
// Returns the modified JSON body and whether any modifications were made.
func ModifyJSON(body []byte, targetKeys []string, injectionValue string) ([]byte, bool) {
	if !gjson.ValidBytes(body) {
		return body, false
	}

	modified := false
	result := body

	for _, keyPath := range targetKeys {
		if gjson.GetBytes(result, keyPath).Exists() {
			var newResult []byte
			var err error

			// Try to parse injection value as JSON first
			if gjson.Valid(injectionValue) {
				parsed := gjson.Parse(injectionValue)
				switch {
				case parsed.IsObject() || parsed.IsArray():
					newResult, err = sjson.SetRawBytes(result, keyPath, []byte(injectionValue))
				case parsed.Type == gjson.Number:
					newResult, err = sjson.SetBytes(result, keyPath, parsed.Float())
				case parsed.Type == gjson.True || parsed.Type == gjson.False:
					newResult, err = sjson.SetBytes(result, keyPath, parsed.Bool())
				case parsed.Type == gjson.Null:
					newResult, err = sjson.SetBytes(result, keyPath, nil)
				default:
					newResult, err = sjson.SetBytes(result, keyPath, parsed.String())
				}
			} else {
				newResult, err = sjson.SetBytes(result, keyPath, injectionValue)
			}

			if err == nil {
				result = newResult
				modified = true
			}
		}
	}

	return result, modified
}

// FindKeys searches a JSON body for all occurrences of a key name
// and returns their paths. Useful for discovering available keys.
func FindKeys(body []byte, keyName string) []string {
	if !gjson.ValidBytes(body) {
		return nil
	}

	var paths []string
	findKeysRecursive(gjson.ParseBytes(body), keyName, "", &paths)
	return paths
}

func findKeysRecursive(result gjson.Result, keyName, currentPath string, paths *[]string) {
	if result.IsObject() {
		result.ForEach(func(key, value gjson.Result) bool {
			path := key.String()
			if currentPath != "" {
				path = currentPath + "." + path
			}
			if key.String() == keyName {
				*paths = append(*paths, path)
			}
			findKeysRecursive(value, keyName, path, paths)
			return true
		})
	} else if result.IsArray() {
		result.ForEach(func(key, value gjson.Result) bool {
			path := currentPath + "." + key.String()
			if currentPath == "" {
				path = key.String()
			}
			findKeysRecursive(value, keyName, path, paths)
			return true
		})
	}
}
