package services

import (
	"testing"
)

func TestCleanSlug(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Normal title with punctuation",
			input:    "The Witcher 3: Wild Hunt - Game of the Year Edition",
			expected: "the-witcher-3-wild-hunt-game-of-the-year-edition",
		},
		{
			name:     "Special characters and extra spaces",
			input:    "  Cyberpunk 2077: Phantom Liberty (DLC)  ",
			expected: "cyberpunk-2077-phantom-liberty-dlc",
		},
		{
			name:     "Special symbols",
			input:    "S.T.A.L.K.E.R. 2: Heart of Chornobyl",
			expected: "s-t-a-l-k-e-r-2-heart-of-chornobyl",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := CleanSlug(tc.input)
			if result != tc.expected {
				t.Errorf("CleanSlug(%q) = %q; esperaba %q", tc.input, result, tc.expected)
			}
		})
	}
}
