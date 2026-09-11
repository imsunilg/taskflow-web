import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  AiConfig,
  AssistantTurn,
  DailyPlan,
  DailySummary,
  NextTaskRecommendation,
  NlSearchResult,
  SubtaskTree,
  TaskAnalysis,
  TaskDraft,
  VoiceCommandResult,
} from '../../core/models/ai.model';
import { ApiResponse } from '../../core/models/api.models';

@Injectable({ providedIn: 'root' })
export class AiApiService {
  private readonly api = inject(ApiService);

  getConfig(): Observable<ApiResponse<AiConfig>> {
    return this.api.get<AiConfig>('/ai/config');
  }

  analyzeText(text: string): Observable<ApiResponse<TaskDraft>> {
    return this.api.post<TaskDraft>('/ai/tasks/analyze', { text });
  }

  getTaskAnalysis(taskId: string): Observable<ApiResponse<TaskAnalysis>> {
    return this.api.get<TaskAnalysis>(`/ai/tasks/${taskId}/analysis`);
  }

  previewBreakdown(taskId: string): Observable<ApiResponse<SubtaskTree>> {
    return this.api.post<SubtaskTree>('/ai/tasks/breakdown', { taskId });
  }

  confirmBreakdown(taskId: string, subtaskTitles: string[]): Observable<ApiResponse<number>> {
    return this.api.post<number>(`/ai/tasks/${taskId}/breakdown/confirm`, { subtaskTitles });
  }

  generateDailyPlan(): Observable<ApiResponse<DailyPlan>> {
    return this.api.post<DailyPlan>('/ai/daily-plan', {});
  }

  nextTask(dismissed: string[] = []): Observable<ApiResponse<NextTaskRecommendation | null>> {
    const q = dismissed.length ? `?${dismissed.map((d) => `dismissed=${d}`).join('&')}` : '';
    return this.api.get<NextTaskRecommendation | null>(`/ai/recommendations/next${q}`);
  }

  dailySummary(): Observable<ApiResponse<DailySummary>> {
    return this.api.get<DailySummary>('/ai/daily-summary');
  }

  search(query: string): Observable<ApiResponse<NlSearchResult>> {
    return this.api.post<NlSearchResult>('/ai/search', { query });
  }

  sendMessage(message: string): Observable<ApiResponse<AssistantTurn>> {
    return this.api.post<AssistantTurn>('/ai/assistant', { message });
  }

  confirmAction(toolName: string, args: Record<string, unknown>): Observable<ApiResponse<AssistantTurn>> {
    return this.api.post<AssistantTurn>('/ai/assistant/confirm', { toolName, arguments: args });
  }

  voiceCommand(transcript: string): Observable<ApiResponse<VoiceCommandResult>> {
    return this.api.post<VoiceCommandResult>('/ai/voice-command', { transcript });
  }
}
