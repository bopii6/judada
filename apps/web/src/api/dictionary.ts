import api from "./client";
import { WordDefinition } from "../data/dictionary";

export const fetchWordDefinition = async (word: string): Promise<WordDefinition> => {
    const { data } = await api.get<{ definition: WordDefinition }>(`/dictionary/${word}`);
    return data.definition;
};
