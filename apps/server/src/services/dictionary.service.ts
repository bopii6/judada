import axios from "axios";

import { callHunyuanChat } from "../lib/hunyuan";
import { HttpError } from "../utils/errors";

interface DictionaryEntry {
    word: string;
    phonetic?: string;
    phonetics: Array<{ text?: string; audio?: string }>;
    meanings: Array<{
        partOfSpeech: string;
        definitions: Array<{
            definition: string;
            example?: string;
        }>;
    }>;
}

export interface FormattedDefinition {
    word: string;
    phonetic: string;
    partOfSpeech: string;
    definition: string;
    definitionCn: string;
    translation: string;
    example: string;
    emoji: string;
    audioUrl?: string;
}

// Smart emoji matching based on word or definition
const getEmojiForWord = (word: string, definition: string, partOfSpeech: string): string => {
    const w = word.toLowerCase();
    const d = definition.toLowerCase();

    // Animal emojis
    if (w.includes('cat') || d.includes('feline')) return '🐱';
    if (w.includes('dog') || d.includes('canine')) return '🐶';
    if (w.includes('bird')) return '🐦';
    if (w.includes('fish')) return '🐟';
    if (w.includes('shark')) return '🦈';
    if (w.includes('star')) return '⭐';
    if (w.includes('baby')) return '👶';
    if (w.includes('twinkle') || w.includes('sparkle')) return '✨';

    // Emotion emojis
    if (w.includes('love') || w.includes('heart')) return '❤️';
    if (w.includes('happy') || w.includes('joy')) return '😊';
    if (w.includes('sad')) return '😢';
    if (w.includes('angry')) return '😠';

    // Nature emojis
    if (w.includes('sun') || w.includes('sunny')) return '☀️';
    if (w.includes('moon')) return '🌙';
    if (w.includes('rain')) return '🌧️';
    if (w.includes('flower')) return '🌸';
    if (w.includes('tree')) return '🌳';

    // Common verbs
    if (w === 'come' || w === 'go') return '🚶';
    if (w === 'eat') return '🍽️';
    if (w === 'sleep') return '😴';
    if (w === 'run') return '🏃';
    if (w === 'swim') return '🏊';

    // Food emojis
    if (d.includes('food') || d.includes('eat')) return '🍴';
    if (d.includes('fruit')) return '🍎';
    if (d.includes('drink')) return '🥤';

    // Part of speech defaults
    if (partOfSpeech === 'verb') return '▶️';
    if (partOfSpeech === 'noun') return '📦';
    if (partOfSpeech === 'adjective') return '✨';

    return '📖';
};

const kidFriendlySystemPrompt = "你是一位幽默有趣的英语启蒙老师，擅长把任何单词解释成3-15岁小朋友能听懂的风格。请确保输出总是可解析的JSON。";

const buildKidFriendlyPrompt = (word: string, definition: string, partOfSpeech: string) => `请把下面的英文释义翻译成小朋友能理解的风格：
单词: ${word}
词性: ${partOfSpeech}
英文释义: ${definition}

请返回一个 JSON，对象必须只包含以下键：
1. "translation": 单词最常见的中文翻译；
2. "definitionCn": 充满想象力、可爱又简洁的解释（1-2句话，适合小朋友，并可包含表情符号）。

示例：
{
  "translation": "苹果",
  "definitionCn": "一种圆圆的水果，咬一口脆脆甜甜的，就像小朋友的脸颊一样可爱！🍎"
}

请只输出 JSON 内容，不要包含额外文本。`;

const extractJsonBlock = (text: string) => {
    const trimmed = text.trim();
    const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```([\s\S]*?)```/);
    return (fencedMatch ? fencedMatch[1] : trimmed).trim();
};

const translateToChinese = async (word: string, definition: string, partOfSpeech: string): Promise<{ translation: string, definitionCn: string }> => {
    try {
        const response = await callHunyuanChat([
            { Role: "system", Content: kidFriendlySystemPrompt },
            { Role: "user", Content: buildKidFriendlyPrompt(word, definition, partOfSpeech) }
        ], { temperature: 0.4 });

        const payload = JSON.parse(extractJsonBlock(response));
        return {
            translation: payload.translation || word,
            definitionCn: payload.definitionCn || definition
        };
    } catch (error) {
        console.error("Hunyuan translation error:", error);
        return { translation: word, definitionCn: definition };
    }
};

export const dictionaryService = {
    lookup: async (word: string): Promise<FormattedDefinition> => {
        try {
            const cleanWord = word.toLowerCase().trim();
            const response = await axios.get<DictionaryEntry[]>(
                `https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`
            );

            const entry = response.data[0];
            if (!entry) {
                throw new HttpError(404, "Word not found");
            }

            // Extract best phonetic
            const phonetic = entry.phonetic || entry.phonetics.find(p => p.text)?.text || "";

            // Extract audio URL (prefer US pronunciation)
            const audioUrl = entry.phonetics.find(p => p.audio && p.audio.includes('-us.'))?.audio
                || entry.phonetics.find(p => p.audio)?.audio
                || undefined;

            // Extract best meaning (prefer noun or verb)
            const meaning =
                entry.meanings.find(m => m.partOfSpeech === "noun") ||
                entry.meanings.find(m => m.partOfSpeech === "verb") ||
                entry.meanings[0];

            const def = meaning?.definitions[0];
            const definition = def?.definition || "No definition found.";
            const example = def?.example || "";
            const partOfSpeech = meaning?.partOfSpeech || "unknown";

            // Get emoji
            const emoji = getEmojiForWord(cleanWord, definition, partOfSpeech);

            // Translate to Chinese via Google for faster lookup
            const { translation, definitionCn } = await translateToChinese(cleanWord, definition, partOfSpeech);

            return {
                word: entry.word,
                phonetic,
                partOfSpeech,
                definition,
                definitionCn,
                translation,
                example,
                emoji,
                audioUrl
            };
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                throw new HttpError(404, "Word not found");
            }
            console.error("Dictionary API error:", error);
            throw new HttpError(500, "Failed to fetch definition");
        }
    }
};
