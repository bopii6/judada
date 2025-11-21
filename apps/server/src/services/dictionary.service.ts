import axios from "axios";
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

// AI-powered translation using OpenAI - Kid-friendly, cute style for ages 3-15
const translateToChinese = async (word: string, definition: string, partOfSpeech: string): Promise<{ translation: string, definitionCn: string }> => {
    try {
        const { getOpenAI } = require('../lib/openai');
        const openai = getOpenAI();

        const prompt = `你是一个超级有趣的英语小老师！🎈 请为 3-15 岁的小朋友翻译和解释这个单词。

单词: ${word}
词性: ${partOfSpeech}
英文释义: ${definition}

请返回一个 JSON 格式的数据，包含以下两个字段：
1. "translation": 单词的中文直译（简单、常用，适合儿童）
2. "definitionCn": 用可爱、生动的方式给小朋友解释这个词的意思（1-2句话）

示例格式：
{
  "translation": "苹果",
  "definitionCn": "一种圆圆的、红红的水果，咬一口脆脆甜甜的，非常好吃！🍎"
}

请只返回 JSON 数据。`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "你是一个JSON生成器。请只返回纯JSON格式的数据，不要包含Markdown标记或其他文本。"
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 200,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content?.trim();
        if (!content) return { translation: word, definitionCn: definition };

        return JSON.parse(content);
    } catch (error) {
        console.error("OpenAI translation error:", error);
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

            // Translate to Chinese using AI (kid-friendly style)
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
