export type RoleId = 'sde1' | 'bank_po' | 'mba_gdpi';

export interface Question {
  id: string;
  role: RoleId;
  question_text: string;
  category: string;
}

export interface Session {
  id: string;
  name: string;
  contact: string;
  role: RoleId;
  question_id: string;
  created_at: string;
  paid: boolean;
  payment_id: string | null;
  plan: 'single' | 'monthly' | null;
  access_expires_at: string | null;
}

export interface ReportScores {
  structure: {
    score: number;
    verdict: 'Present' | 'Weak' | 'Missing';
    explanation: string;
  };
  specificity: {
    score: number;
    explanation: string;
    vague_quote_example: string;
  };
  filler_words: {
    score: number;
    count: number;
    per_100_words: number;
    most_common: string[];
  };
  confidence_language: {
    score: number;
    hedging_example: string | null;
    confident_example: string | null;
  };
  role_correctness: {
    score: number;
    explanation: string;
  };
}

export interface InterviewReport {
  overall_score: number;
  headline_insight: string;
  structure: ReportScores['structure'];
  specificity: ReportScores['specificity'];
  filler_words: ReportScores['filler_words'];
  confidence_language: ReportScores['confidence_language'];
  role_correctness: ReportScores['role_correctness'];
  rewritten_answer: string;
}
