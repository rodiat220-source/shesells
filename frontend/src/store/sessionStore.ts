"use client";

import { create } from "zustand";
import type { CustomerState, DimensionReasoning, Dimensions, Message, PersonaResult, Session } from "@/src/types";
import {
  continueTrainingSession,
  createTrainingSession,
  finishTrainingSession,
  generatePersona as generatePersonaApi,
  loadTrainingSession,
  sendTrainingMessage,
} from "@/src/lib/backendApi";

interface SessionStore {
  session: Session | null;
  messages: Message[];
  isLoading: boolean;
  isFinishing: boolean;
  isContinuingAfterHalt: boolean;
  isHalted: boolean;
  error: string | null;
  persona: PersonaResult | null;
  isGeneratingPersona: boolean;
  loadSession: (sessionId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  continueAfterHalt: () => Promise<void>;
  finishSession: () => Promise<boolean>;
  generatePersona: (tags: { age: string; oiliness: string; sensitivity: string; concernText?: string }) => Promise<boolean>;
  startSession: () => Promise<void>;
  reset: () => void;
}

const messageDelay = 420;
const maxTrainingTurns = 12;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  messages: [],
  isLoading: false,
  isFinishing: false,
  isContinuingAfterHalt: false,
  isHalted: false,
  error: null,
  persona: null,
  isGeneratingPersona: false,

  loadSession: async (sessionId) => {
    set({ isLoading: true, error: null });
    try {
      const session = await loadTrainingSession(sessionId);
      set({ session, messages: session.messages, isLoading: false, isHalted: session.status === "halted" });
    } catch {
      set({ error: "暂时无法加载训练，请稍后重试。", isLoading: false });
    }
  },

  sendMessage: async (content) => {
    const { session, messages } = get();
    if (!session || !content.trim() || get().isLoading) return;

    const turn = messages.filter((message) => message.role === "ba").length + 1;
    const baMessage: Message = {
      id: `ba_${Date.now()}`,
      turn,
      role: "ba",
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };
    set({ messages: [...messages, baMessage], isLoading: true, error: null });

    try {
      const data = await sendTrainingMessage(session.sessionId, content.trim(), turn) as {
        newMessages: Message[];
        updatedState?: Partial<CustomerState>;
        updatedDimensions?: Dimensions;
        updatedDimensionReasoning?: DimensionReasoning;
        sessionStatus: Session["status"];
      };

      for (const message of data.newMessages) {
        await wait(messageDelay);
        set((state) => ({ messages: [...state.messages, message] }));
      }

      const isHalted = data.newMessages.some((message) => message.metadata?.requiresAction);
      const shouldAutoFinish = !isHalted && data.sessionStatus === "active" && turn >= maxTrainingTurns;
      set((state) => ({
        isLoading: false,
        isHalted,
        session: state.session
          ? {
              ...state.session,
              status: data.sessionStatus,
              baTurnCount: turn,
              customerState: data.updatedState
                ? { ...state.session.customerState, ...data.updatedState }
                : state.session.customerState,
              dimensions: data.updatedDimensions ?? state.session.dimensions,
              dimensionReasoning: data.updatedDimensionReasoning ?? state.session.dimensionReasoning,
            }
          : null,
      }));

      if (shouldAutoFinish) {
        void get().finishSession();
      }
    } catch {
      set({ error: "消息没有发出去，请再试一次。", isLoading: false });
    }
  },

  continueAfterHalt: async () => {
    const { session } = get();
    if (!session || get().isLoading || get().isContinuingAfterHalt) return;

    set({ isContinuingAfterHalt: true, error: null });
    try {
      const data = await continueTrainingSession(session.sessionId) as {
        updatedState?: Partial<CustomerState>;
        updatedDimensions?: Dimensions;
        updatedDimensionReasoning?: DimensionReasoning;
        sessionStatus: Session["status"];
      };
      set((state) => ({
        isContinuingAfterHalt: false,
        isHalted: false,
        session: state.session
          ? {
              ...state.session,
              status: data.sessionStatus,
              customerState: data.updatedState
                ? { ...state.session.customerState, ...data.updatedState }
                : state.session.customerState,
              dimensions: data.updatedDimensions ?? state.session.dimensions,
              dimensionReasoning: data.updatedDimensionReasoning ?? state.session.dimensionReasoning,
            }
          : null,
      }));
    } catch {
      set({ error: "暂时无法继续训练，请稍后重试。", isContinuingAfterHalt: false });
    }
  },

  finishSession: async () => {
    const { session } = get();
    if (!session || get().isLoading || get().isFinishing) return false;
    set({ isFinishing: true, error: null, isHalted: false });
    try {
      const data = await finishTrainingSession(session.sessionId, session.baTurnCount);
      for (const message of data.newMessages) {
        await wait(messageDelay);
        set((state) => ({ messages: [...state.messages, message] }));
      }
      set((state) => ({
        isFinishing: false,
        session: state.session
          ? {
              ...state.session,
              status: "completed",
              dimensions: data.updatedDimensions ?? state.session.dimensions,
            }
          : null,
      }));
      return true;
    } catch {
      set({ error: "总结生成失败，请稍后重试。", isFinishing: false });
      return false;
    }
  },

  generatePersona: async (tags) => {
    set({ isGeneratingPersona: true, error: null });
    try {
      const result = await generatePersonaApi(tags);
      set({ persona: result, isGeneratingPersona: false });
      return true;
    } catch {
      set({ error: "画像生成失败，请稍后重试。", isGeneratingPersona: false });
      return false;
    }
  },

  startSession: async () => {
    const { persona } = get();
    if (!persona) return;
    set({ isLoading: true, error: null });
    try {
      const data = await createTrainingSession({
        customerProfile: persona.customerProfile,
        initialMessage: persona.initialMessage,
      });
      set({ isLoading: false });
      // 返回 sessionId 给调用方使用（通过外部 router.push）
    } catch {
      set({ error: "创建训练失败，请稍后重试。", isLoading: false });
    }
  },

  reset: () => set({ session: null, messages: [], isLoading: false, isFinishing: false, isContinuingAfterHalt: false, isHalted: false, error: null, persona: null, isGeneratingPersona: false }),
}));
