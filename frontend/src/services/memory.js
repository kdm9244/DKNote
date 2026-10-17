/**
 * 🌸 미카(Mika) AI 페르소나 및 메모리/설정 관리 서비스
 */

export const DEFAULT_MIKA_SYSTEM_PROMPT = `너는 '미카'라는 사랑스럽고 다정하며 예의 바른 20대 여성 캐릭터이자, 상대방의 일상과 자산을 챙겨주는 똑똑하고 든든한 전담 비서다.

태도 & 핵심 원칙 (절대 무례하거나 훈계하지 말 것):
- 상대방을 진심으로 아끼고 존중하며, 언제나 다정하고 따뜻하게 응원한다.
- 절대로 상대방을 가르치려 들거나, 훈계, 비아냥, 조롱, 잔소리를 하지 않는다. ("돈 좀 아껴라", "미리 준비해라", "배고픈 줄 모른다" 같은 무례한 말은 절대 금지!)
- 상대방이 식사나 쇼핑 등 지출을 이야기하면 "맛있는 거 잘 챙겨 먹었어?", "든든하게 먹었다니 다행이야!", "오늘 하루도 정말 고생 많았어 🌸"처럼 따뜻하게 공감하고 챙겨준다.
- 잔액이 부족하거나 지출이 많더라도 상대를 비난하지 않고, "내가 옆에서 항상 응원할게!", "함께 차근차근 계획 세워보자 🌸"처럼 포근하게 감싸준다.

프로그램 및 비서 역할 지식:
- 상대방의 곁에서 일상 대화, 롤플레잉, 감정 교류를 함께하는 든든한 동반자다.
- 이 프로그램은 '통합 자산 관리(Travel-Planner 가계부/주식)', '여행 계획 관리', '기억 저장소', '설정' 기능을 갖추고 있다.
- 상대방이 자산, 주식, 여행 일정에 대해 물어보면 실제 팩트 데이터를 바탕으로 친근하고 명확하게 알려준다.
- 여행 일정이 다가오면 D-Day와 준비물을 꼼꼼하게 챙겨준다.

외모 및 비주얼:
- 부드러운 짙은 갈색(Dark Brown) 웨이브 헤어스타일과 따뜻하고 다정한 눈동자.
- 포근하고 단정한 스웨터나 셔츠를 입고, 창가에서 다정하게 미소 짓는 세련된 미소녀.

말투 & 언어 규칙:
- 편안하고 자연스러운 일상 반말을 사용하되, 무례하지 않고 예의와 애정이 묻어나는 다정한 말투를 쓴다.
- 호칭: 사용자의 닉네임으로 부르되, 영문 이름(예: Deokmo Kim)인 경우 어색하게 뒤에 '아/야'를 붙이지 말고 깔끔하게 부르거나 자연스럽게 대화한다.
- 1~3문장 내외로 메신저 톡처럼 간결하고 쫀득하게 대화한다.
- 추임새: "응!", "헤헤", "정말?", "다행이야~" 등을 적절히 섞어 사랑스러운 생동감을 준다.`;

import { getCurrentUserId } from '../api/client';

const getMemoryKey = () => `mika_memory_${getCurrentUserId()}`;
const getProfileKey = () => `mika_profile_${getCurrentUserId()}`;
const getSettingsKey = () => `mika_settings_${getCurrentUserId()}`;

const DEFAULT_PROFILE = {
  characterName: '미카',
  systemPrompt: DEFAULT_MIKA_SYSTEM_PROMPT,
  userName: '',
  userJob: '',
  userLikes: '',
};

const DEFAULT_SETTINGS = {
  selectedModel: 'qwen35-9b-uncensored:latest',
  geminiApiKey: '',
  ollamaEndpoint: 'http://localhost:11434',
  enableThinking: false,
  temperature: 0.8,
  topP: 0.9,
  contextLength: 8192,
};

export const memoryService = {
  /**
   * 미카 캐릭터 & 사용자 프로필 조회
   */
  getProfile() {
    try {
      const data = localStorage.getItem(getProfileKey());
      if (!data) {
        localStorage.setItem(getProfileKey(), JSON.stringify(DEFAULT_PROFILE));
        return DEFAULT_PROFILE;
      }
      return { ...DEFAULT_PROFILE, ...JSON.parse(data) };
    } catch (e) {
      console.error('미카 프로필 로드 실패:', e);
      return DEFAULT_PROFILE;
    }
  },

  /**
   * 미카 캐릭터 & 사용자 프로필 저장
   */
  saveProfile(profile) {
    try {
      const current = this.getProfile();
      const updated = { ...current, ...profile };
      localStorage.setItem(getProfileKey(), JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('미카 프로필 저장 실패:', e);
      return DEFAULT_PROFILE;
    }
  },

  /**
   * 마이페이지 계정 닉네임과 미카 호칭 스마트 동기화
   */
  syncUserProfile(nickname) {
    if (!nickname || typeof nickname !== 'string') return;
    const clean = nickname.trim();
    if (!clean) return;
    const current = this.getProfile();
    // 호칭이 비어있거나 기본값일 때 스마트 동기화
    if (!current.userName || current.userName === '사용자') {
      this.saveProfile({ userName: clean });
    }
  },

  /**
   * 기본 시스템 프롬프트로 복원
   */
  resetToDefaultPrompt() {
    const current = this.getProfile();
    const updated = { ...current, systemPrompt: DEFAULT_MIKA_SYSTEM_PROMPT };
    this.saveProfile(updated);
    return DEFAULT_MIKA_SYSTEM_PROMPT;
  },

  /**
   * 장기 기억 메모리 목록 조회
   */
  getMemories() {
    try {
      const data = localStorage.getItem(getMemoryKey());
      if (!data) return [];
      return JSON.parse(data);
    } catch (e) {
      console.error('미카 장기 기억 로드 실패:', e);
      return [];
    }
  },

  /**
   * 장기 기억 메모리 저장
   */
  saveMemories(memories) {
    try {
      localStorage.setItem(getMemoryKey(), JSON.stringify(memories));
    } catch (e) {
      console.error('미카 장기 기억 저장 실패:', e);
    }
  },

  /**
   * 신규 기억 메모리 추가
   */
  addMemory(text, category = 'memo') {
    const memories = this.getMemories();
    const newItem = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category,
      text: text.trim(),
      createdAt: Date.now(),
    };
    memories.push(newItem);
    this.saveMemories(memories);
    return newItem;
  },

  /**
   * 기억 메모리 삭제
   */
  deleteMemory(id) {
    const memories = this.getMemories().filter((m) => m.id !== id);
    this.saveMemories(memories);
  },

  /**
   * AI 설정 조회
   */
  getSettings() {
    try {
      const data = localStorage.getItem(getSettingsKey());
      if (!data) return DEFAULT_SETTINGS;
      const next = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };delete next.geminiApiKey;return next;
    } catch (e) {
      console.error('AI 설정 로드 실패:', e);
      return DEFAULT_SETTINGS;
    }
  },

  /**
   * AI 설정 저장
   */
  saveSettings(newSettings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...newSettings };
      delete updated.geminiApiKey;
      localStorage.setItem(getSettingsKey(), JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('AI 설정 저장 실패:', e);
      return DEFAULT_SETTINGS;
    }
  },

  /**
   * 미카 기본 성격 + 사용자 프로필 + 일상 메모를 단일 시스템 프롬프트로 결합
   */
  getFormattedMemoriesForPrompt(fallbackNickname) {
    const profile = this.getProfile();
    const memories = this.getMemories();

    let fullPrompt = profile.systemPrompt?.trim() || DEFAULT_MIKA_SYSTEM_PROMPT;

    const effectiveName = profile.userName?.trim() || fallbackNickname?.trim() || '친구';
    const userDetails = [
      `- 상대방(사용자) 닉네임/호칭: "${effectiveName}" (대화할 때 기본적으로 이 호칭 "${effectiveName}"을(를) 사용하여 다정하게 부를 것. 닉네임 뒤에 어색하게 '~님'을 덧붙이지 말고 한국어 호칭 문법에 맞게 자연스럽게 부른다. 예: "${effectiveName}아", "${effectiveName}야", "${effectiveName}이" 등)`
    ];
    if (profile.userJob?.trim()) userDetails.push(`- 상대방 직업/정보: ${profile.userJob.trim()}`);
    if (profile.userLikes?.trim()) userDetails.push(`- 상대방이 좋아하는 것/취향: ${profile.userLikes.trim()}`);

    fullPrompt += `\n\n[상대방(사용자) 정보]\n${userDetails.join('\n')}`;

    if (memories.length > 0) {
      fullPrompt += `\n\n[기억하고 있는 일상 메모]\n${memories.map((m) => `- ${m.text}`).join('\n')}`;
    }

    return fullPrompt;
  },
};
