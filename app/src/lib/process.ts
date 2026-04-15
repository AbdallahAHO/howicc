import type PocketBase from 'pocketbase';
import {
  analyzeConversation,
  collectRedactionStats,
} from './ai-analysis';
import { Collections, ConversationStatus, ensureTagsByNames } from './pb';
import type { ConversationRecord } from '@howicc/schemas';

/**
 * In-memory queue for processing conversations
 * For production, consider using a proper job queue (BullMQ, etc.)
 */
class ProcessingQueue {
  private pending = new Set<string>();
  private processing = new Map<string, Promise<void>>();

  /**
   * Add a conversation to the processing queue
   */
  async enqueue(conversationId: string, processor: () => Promise<void>): Promise<void> {
    // Check if already processing
    if (this.pending.has(conversationId) || this.processing.has(conversationId)) {
      console.log(`Conversation ${conversationId} is already queued or processing`);
      return;
    }

    this.pending.add(conversationId);

    // Start processing in background
    const processingPromise = (async () => {
      this.pending.delete(conversationId);
      try {
        await processor();
      } catch (error) {
        console.error(`Failed to process conversation ${conversationId}:`, error);
      } finally {
        this.processing.delete(conversationId);
      }
    })();

    this.processing.set(conversationId, processingPromise);
  }

  /**
   * Wait for a specific conversation to finish processing
   */
  async wait(conversationId: string): Promise<void> {
    const promise = this.processing.get(conversationId);
    if (promise) {
      await promise;
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      pending: this.pending.size,
      processing: this.processing.size,
    };
  }
}

// Global processing queue instance
export const processingQueue = new ProcessingQueue();

/**
 * Process a conversation: analyze timeline and update PocketBase
 */
export async function processConversation(
  pb: PocketBase,
  conversationId: string
): Promise<void> {
  console.log(`[Process] Processing conversation: ${conversationId}`);

  try {
    // 1. Fetch the conversation record with timeline
    const conversation = await pb
      .collection<ConversationRecord>(Collections.CONVERSATIONS)
      .getOne(conversationId);

    console.log(`[Process] Conversation ${conversationId} status: ${conversation.status}, timeline length: ${conversation.timeline?.length || 0}`);

    if (!conversation.timeline || conversation.timeline.length === 0) {
      throw new Error('No timeline data in conversation');
    }

    // 2. Perform AI analysis on timeline
    const aiAnalysis = await analyzeConversation(conversation.timeline);

    // 3. Perform safety checks on timeline content
    // Serialize timeline to string for regex-based safety checks
    const timelineContent = JSON.stringify(conversation.timeline);
    const safetyStats = collectRedactionStats(timelineContent);

    // Combine AI-detected and regex-detected safety flags
    const combinedSafetyFlags = {
      pii: aiAnalysis.safety_flags.pii || safetyStats.pii,
      secrets: aiAnalysis.safety_flags.secrets || safetyStats.secrets,
    };

    // 4. Ensure tags exist and get their IDs
    const tagIds = await ensureTagsByNames(pb, aiAnalysis.generated_tags);

    // 5. Determine final status
    let status: string = ConversationStatus.PROCESSED;
    if (combinedSafetyFlags.pii || combinedSafetyFlags.secrets) {
      status = ConversationStatus.NEEDS_REVIEW;
    }

    // 6. Update the conversation record
    await pb.collection(Collections.CONVERSATIONS).update(conversationId, {
      description_ai: aiAnalysis.summary,
      summary: aiAnalysis.summary,
      takeaways: aiAnalysis.takeaways,
      safety_flags: combinedSafetyFlags,
      tags: tagIds,
      status,
      // Only use AI title if user didn't provide one
      ...(conversation.title === 'Untitled Conversation' && { title: aiAnalysis.title }),
    });

    console.log(`✅ Successfully processed conversation: ${conversationId}`);
  } catch (error) {
    console.error(`❌ Error processing conversation ${conversationId}:`, error);

    // Update status to indicate processing failure
    try {
      await pb.collection(Collections.CONVERSATIONS).update(conversationId, {
        status: ConversationStatus.NEEDS_REVIEW,
        description_ai: 'Processing failed. Please review manually.',
      });
    } catch (updateError) {
      console.error('Failed to update conversation status:', updateError);
    }

    throw error;
  }
}

/**
 * Queue a conversation for processing
 */
export function queueProcessing(pb: PocketBase, conversationId: string): void {
  processingQueue.enqueue(conversationId, () => processConversation(pb, conversationId));
}
