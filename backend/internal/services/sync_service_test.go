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

func TestTitlesMatch(t *testing.T) {
	tests := []struct {
		titleA   string
		titleB   string
		expected bool
	}{
		{
			titleA:   "DEATH STRANDING Director's Cut",
			titleB:   "DEATH STRANDING Directors Cut",
			expected: true,
		},
		{
			titleA:   "DEATH STRANDING Director's Cut",
			titleB:   "DEATH STRANDING: Director's Cut",
			expected: true,
		},
		{
			titleA:   "DEATH STRANDING Director's Cut",
			titleB:   "Death Stranding (Director's Cut)",
			expected: true,
		},
		{
			titleA:   "DEATH STRANDING Director's Cut",
			titleB:   "DEATH STRANDING 2: ON THE BEACH",
			expected: false,
		},
		{
			titleA:   "Cyberpunk 2077",
			titleB:   "Cyberpunk 2077",
			expected: true,
		},
	}

	for _, tc := range tests {
		match := TitlesMatch(tc.titleA, tc.titleB)
		if match != tc.expected {
			t.Errorf("TitlesMatch(%q, %q) = %v; esperaba %v", tc.titleA, tc.titleB, match, tc.expected)
		}
	}
}
