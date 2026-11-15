
import { NextResponse } from 'next/server';
import {
  createSupabaseServiceClient,
  verifyTelegramInitData,
  recordLeadershipTaskReward,
} from '@/lib/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SOCIAL_TASKS: Record<
  string,
  { reward: number; platform: string }
> = {
  task_follow_x: { reward: 50, platform: 'X' },
  social_main_channel: { reward: 100, platform: 'Telegram' },
  social_chat_group: { reward: 100, platform: 'Telegram' },
  social_payment_proof: { reward: 100, platform: 'Telegram' },
  social_tiktok: { reward: 100, platform: 'TikTok' },
  social_youtube: { reward: 100, platform: 'YouTube' },
  social_x: { reward: 100, platform: 'X' },
  boost_main_channel: { reward: 5000, platform: 'Telegram' },
  boost_proof_channel: { reward: 5000, platform: 'Telegram' },
  task_join_channel: { reward: 50, platform: 'Telegram' },
  task_join_group: { reward: 50, platform: 'Telegram' },
  task_payment_proof: { reward: 50, platform: 'Telegram' },
  task_stars_group: { reward: 50, platform: 'Telegram' },
  task_sub_youtube: { reward: 50, platform: 'YouTube' },
};

const TELEGRAM_MEMBERSHIP_TASKS: Record<string, string> = {
  task_join_channel: '@Streethustlegame2',
  task_join_group: '@Streethustlechatroom',
  task_payment_proof: '@Streethustlepaymentproof',
  task_stars_group: '@Streetlifestars',
  social_main_channel: '@Streethustlegame2',
  social_chat_group: '@Streethustlechatroom',
  social_payment_proof: '@Streethustlepaymentproof',
};

async function verifyTelegramMembership(
  telegramUserId: number,
  taskKey: string
): Promise<{ verified: boolean; reason?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = TELEGRAM_MEMBERSHIP_TASKS[taskKey];

  if (!botToken || !chatId) {
    throw new Error('Telegram membership verification is not configured for this task.');
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${telegramUserId}`,
    { cache: 'no-store' }
  );
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok || !result?.result) {
    console.error('Telegram getChatMember failed:', {
      taskKey,
      httpStatus: response.status,
      errorCode: result?.error_code,
      description: result?.description,
    });
    throw new Error('Telegram could not verify membership right now. Please try again later.');
  }

  const member = result.result;
  const isMember =
    member.status === 'creator' ||
    member.status === 'administrator' ||
    member.status === 'member' ||
    (member.status === 'restricted' && member.is_member === true);

  return isMember
    ? { verified: true }
    : { verified: false, reason: 'Join the required Telegram channel or group before claiming this reward.' };
}

async function ensurePlayerRecord(supabase: ReturnType<typeof createSupabaseServiceClient>, user: { id: number; username?: string; first_name?: string; last_name?: string; photo_url?: string }) {
  const { error } = await supabase
    .from('players')
    .upsert(
      {
        telegram_id: String(user.id),
        username: user.username || null,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        photo_url: user.photo_url || null,
        coins: 1000,
      },
      { onConflict: 'telegram_id', ignoreDuplicates: true }
    );

  if (error) {
    console.error('Task player ensure error:', error);
    throw new Error('Could not prepare the player account for task rewards.');
  }
}

function getInitData(request: Request, body?: any): string {
  if (typeof body?.initData === 'string') {
    return body.initData;
  }

  return request.headers.get('x-telegram-init-data') || '';
}

function getTaskDetails(body: any) {
  const key = String(body?.key || '').trim();
  const type = String(body?.type || '');

  if (type === 'social') {
    const task = SOCIAL_TASKS[key];

    if (!task) {
      throw new Error('This task is not recognised.');
    }

    return {
      key,
      type,
      reward: task.reward,
      platform: task.platform,
    };
  }

  if (type === 'status_post' && key.startsWith('status_post_')) {
    const platform = String(body.platform || '');

    if (!['WhatsApp', 'Telegram'].includes(platform)) {
      throw new Error('Invalid status platform.');
    }

    return {
      key,
      type,
      reward: 50,
      platform,
    };
  }

  if (type === 'boost' && key.startsWith('boost_')) {
    return {
      key,
      type,
      reward: 1000,
      platform: 'Telegram',
    };
  }

  if (type === 'video' && (key === 'video_promo' || key === 'video_promo_task')) {
    const platform = String(body.platform || '');
    const allowedPlatforms = key === 'video_promo_task'
      ? ['TikTok', 'YouTube', 'Facebook']
      : ['TikTok', 'YouTube'];

    if (!allowedPlatforms.includes(platform)) {
      throw new Error('Invalid video platform.');
    }

    return {
      key,
      type,
      reward: key === 'video_promo_task' ? 200 : 2000,
      platform,
    };
  }

  throw new Error('Invalid task submission.');
}

function validateProof(body: any, type: string) {
  const proofUrl =
    typeof body.proofUrl === 'string'
      ? body.proofUrl.trim()
      : '';

  if (proofUrl.length > 2000) {
    throw new Error('The proof link is too long.');
  }

  const screenshots = Array.isArray(body.screenshots)
    ? body.screenshots
    : [];

  if (screenshots.length > 3) {
    throw new Error('You can submit a maximum of 3 screenshots.');
  }

  for (const screenshot of screenshots) {
    if (
      typeof screenshot !== 'string' ||
      screenshot.length > 2_500_000 ||
      !screenshot.startsWith('data:image/')
    ) {
      throw new Error('One of your screenshots is invalid or too large.');
    }
  }

  if (
    ['status_post', 'boost', 'video'].includes(type) &&
    screenshots.length === 0
  ) {
    throw new Error('Please attach proof before submitting this task.');
  }

  if (type === 'video') {
    let validUrl = false;

    try {
      const parsed = new URL(proofUrl);
      validUrl = ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      validUrl = false;
    }

    if (!validUrl) {
      throw new Error('Please provide a valid video link.');
    }
  }

  return {
    proofUrl: proofUrl || null,
    screenshots,
  };
}

// GET: Return only the signed-in player's own submissions.
export async function GET(request: Request) {
  try {
    const initData = getInitData(request);

    const user = verifyTelegramInitData(initData);
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from('task_submissions')
      .select(
        'id, player_telegram_id, task_key, task_type, platform, proof_url, screenshot_urls, reward, status, denial_reason, submitted_at'
      )
      .eq('player_telegram_id', String(user.id))
      .order('submitted_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Player task GET error:', error);
      return NextResponse.json(
        { error: 'Could not load your task history.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { submissions: data || [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Telegram verification failed.';

    return NextResponse.json({ error: message }, { status: 401 });
  }
}

// POST: Save proof as pending. This route NEVER credits coins.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid submission.' },
        { status: 400 }
      );
    }

    const user = verifyTelegramInitData(getInitData(request, body));
    const task = getTaskDetails(body);
    const proof = validateProof(body, task.type);

    const supabase = createSupabaseServiceClient();
    await ensurePlayerRecord(supabase, user);

    const isTelegramMembershipTask =
      task.type === 'social' && Boolean(TELEGRAM_MEMBERSHIP_TASKS[task.key]);

    if (isTelegramMembershipTask) {
      const membership = await verifyTelegramMembership(user.id, task.key);
      if (!membership.verified) {
        return NextResponse.json(
          { error: membership.reason || 'Telegram membership could not be verified.' },
          { status: 403 }
        );
      }
    }

    // Prevent duplicate pending or already-approved submissions.
    const { data: existing, error: lookupError } = await supabase
      .from('task_submissions')
      .select('id, status')
      .eq('player_telegram_id', String(user.id))
      .eq('task_key', task.key)
      .in('status', ['pending', 'approved'])
      .limit(1);

    if (lookupError) {
      console.error('Task duplicate-check error:', lookupError);
      return NextResponse.json(
        { error: 'Could not check your previous submissions.' },
        { status: 500 }
      );
    }

    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          error:
            existing[0].status === 'approved'
              ? 'This task has already been approved.'
              : 'This task is already waiting for review.',
        },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('task_submissions')
      .insert({
        player_telegram_id: String(user.id),
        player_username: user.username || user.first_name || 'Telegram Player',
        task_key: task.key,
        task_type: task.type,
        platform: task.platform,
        proof_url: proof.proofUrl,
        screenshot_urls: proof.screenshots,
        reward: task.reward,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      })
      .select(
        'id, task_key, task_type, platform, proof_url, screenshot_urls, reward, status, denial_reason, submitted_at'
      )
      .single();

    if (error) {
      console.error('Task submission insert error:', error);
      return NextResponse.json(
        { error: 'Could not save your task submission.' },
        { status: 500 }
      );
    }

    if (isTelegramMembershipTask) {
      const { data: approvalData, error: approvalError } = await supabase.rpc(
        'approve_streetlife_task',
        {
          p_submission_id: data.id,
          p_admin_telegram_id: 'TELEGRAM_BOT_API',
        }
      );

      if (approvalError) {
        console.error('Automatic Telegram task approval error:', approvalError);
        return NextResponse.json(
          {
            ok: true,
            status: 'pending',
            autoVerified: false,
            message: 'Telegram membership was verified, but automatic reward credit is temporarily unavailable. Your submission has been sent for admin review.',
            submission: data,
          },
          { status: 201 }
        );
      }

      const approval = Array.isArray(approvalData) ? approvalData[0] : approvalData;
      if (approval?.success) {
        const leadershipTracked = await recordLeadershipTaskReward(
          supabase, user.id, String(data.id), Number(approval.credited || 0), task.key
        );
        return NextResponse.json(
          {
            ok: true,
            status: 'approved',
            autoVerified: true,
            credited: approval.credited,
            leadershipTracked,
            message: `Telegram membership verified! ${approval.credited} SC credited.`,
            submission: { ...data, status: 'approved' },
          },
          { status: 201 }
        );
      }

      console.error('Automatic Telegram task approval was not successful:', approval);
      return NextResponse.json(
        {
          ok: true,
          status: 'pending',
          autoVerified: false,
          message: approval?.message || 'Membership verified, but the reward needs admin review.',
          submission: data,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        status: 'pending',
        autoVerified: false,
        message: 'Proof submitted. Waiting for admin review.',
        submission: data,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Task submission failed.';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
