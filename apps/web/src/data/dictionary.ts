export interface WordDefinition {
    word: string;
    phonetic: string;
    partOfSpeech: string;
    definition: string;
    definitionCn?: string;
    translation?: string; // Added direct translation
    example: string;
    emoji: string;
    audioUrl?: string;
}

export const MOCK_DICTIONARY: Record<string, WordDefinition> = {
    "baby": {
        word: "baby",
        phonetic: "/ˈbeɪbi/",
        partOfSpeech: "noun",
        definition: "A very young child, especially one newly or recently born.",
        definitionCn: "刚出生的小宝宝，还不会走路的小可爱！👶",
        translation: "婴儿",
        example: "The baby is sleeping.",
        emoji: "👶"
    },
    "shark": {
        word: "shark",
        phonetic: "/ʃɑːrk/",
        partOfSpeech: "noun",
        definition: "A long-bodied chiefly marine fish with a cartilaginous skeleton.",
        definitionCn: "住在大海里的大鱼，有尖尖的牙齿！🦈",
        translation: "鲨鱼",
        example: "Sharks live in the ocean.",
        emoji: "🦈"
    }
};
