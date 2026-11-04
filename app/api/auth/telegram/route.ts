
import { NextResponse } from 'next/server';
import {
  createSupabaseServiceClient,
  verifyTelegramInitData,
} from '@/lib/server/taskAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TASKS: Record<string, {
  reward: number;
  platform: string;
  telegramChat?: string;
}> = {
  task_follow_x: { reward: 50, platform: 'X' },
  task_join_channel: {
    reward: 50,
    platform: 'Telegram',
    telegramChat: '@Streethustlegame2',
  },
  task_join_group: {
    reward: 50,
    platform: 'Telegram',
    telegramChat: '@Streethustlechatroom',
  },
  task_payment_proof: {
    reward: 50,
    platform: 'Telegram',
    telegramChat: '@Streethustlepaymentproof',
  },
  task_stars_group: {
    reward: 50,
    platform: 'Telegram',
    telegramChat: '@Streetlifestars',
  },
  task_sub_youtube: { reward: 50, platform: 'YouTube' },
};

async function verifyTelegramMembership(
  chatUsername: string,
  telegramUserId: number
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing from Vercel environment variables.');
  }

  const params = new URLSearchParams({
    chat_id: chatUsername,
    user_id: String(telegramUserId),
  });

  const response = await fetch(
    `https://api.telegram.org/bot${token}/getChatMember?${params.toString()}`,
    { method: 'GET', cache: 'no-store' }
  );

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok || !result?.result) {
    throw new Error(
      result?.description || 'Telegram could not verify this membership.'
    );
  }

  const member = result.result;

  return (
    member.status === 'creator' ||
    member.status === 'administrator' ||
    member.status === 'member' ||
    (member.status === 'restricted' && member.is_member === true)
  );
}

const MAX_PROOF_LENGTH = 1_350_000;

function validImageData(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_PROOF_LENGTH &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
  );
}

function validPublicUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false;

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
    const initData =
      request.headers.get('x-telegram-init-data') || '';

    const user = verifyTelegramInitData(initData);
    const supabase = createSupabaseServiceClient();

    const telegramId = String(user.id);

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('telegram_id')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (playerError || !player) {
      return NextResponse.json(
        { error: 'Player account was not found. Reopen the game through Telegram.' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('task_submissions')
      .select(
        'id, task_key, task_type, platform, proof_url, screenshot_urls, reward, status, denial_reason, submitted_at'
      )
      .eq('player_telegram_id', telegramId)
      .order('submitted_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json(
      { submissions: data || [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('GET /api/tasks:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not load task submissions.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body.initData !== 'string') {
      return NextResponse.json(
        { error: 'Missing Telegram login data.' },
        { status: 400 }
      );
    }

    const user = verifyTelegramInitData(body.initData);
    const supabase = createSupabaseServiceClient();
    const telegramId = String(user.id);

    const taskKey = typeof body.key === 'string' ? body.key : '';
    const taskType = typeof body.type === 'string' ? body.type : '';
    const screenshots = body.screenshots;

    if (taskKey.length < 3 || taskKey.length > 100) {
      return NextResponse.json(
        { error: 'Invalid task key.' },
        { status: 400 }
      );
    }

    const telegramTask =
      TASKS[taskKey]?.platform === 'Telegram' ? TASKS[taskKey] : null;

    if (
      !telegramTask &&
      (!Array.isArray(screenshots) ||
        screenshots.length < 1 ||
        screenshots.length > 2 ||
        !screenshots.every(validImageData))
    ) {
      return NextResponse.json(
        { error: 'Upload one or two valid screenshot proofs. PNG, JPG or WEBP images only.' },
        { status: 400 }
      );
    }

    if (
      telegramTask &&
      screenshots !== undefined &&
      (!Array.isArray(screenshots) || screenshots.length > 0)
    ) {
      return NextResponse.json(
        { error: 'Telegram membership tasks do not need screenshot proof.' },
        { status: 400 }
      );
    }

    let reward = 0;
    let dbTaskType = taskType;

    if (TASKS[taskKey]) {
      reward = TASKS[taskKey].reward;
      dbTaskType = 'social';
    } else if (taskType === 'status_post') {
      reward = 50;

      if (!['WhatsApp', 'Telegram'].includes(String(body.platform))) {
        return NextResponse.json(
          { error: 'Invalid status platform.' },
          { status: 400 }
        );
      }

      if (
        body.platform === 'Telegram' &&
        !validPublicUrl(body.proofUrl)
      ) {
        return NextResponse.json(
          { error: 'A valid Telegram status link is required.' },
          { status: 400 }
        );
      }

      if (
        body.platform === 'WhatsApp' &&
        screenshots.length !== 2
      ) {
        return NextResponse.json(
          { error: 'WhatsApp status needs both status/date and view-count screenshots.' },
          { status: 400 }
        );
      }
    } else if (taskType === 'boost') {
      reward = 1000;

      if (body.platform !== 'Telegram') {
        return NextResponse.json(
          { error: 'Invalid boost platform.' },
          { status: 400 }
        );
      }
    } else if (taskType === 'video') {
      reward = 2000;

      if (!validPublicUrl(body.proofUrl)) {
        return NextResponse.json(
          { error: 'Enter a valid HTTPS video URL.' },
          { status: 400 }
        );
      }

      const host = new URL(body.proofUrl).hostname.toLowerCase();

      if (
        !(
          host === 'youtube.com' ||
          host.endsWith('.youtube.com') ||
          host === 'youtu.be' ||
          host === 'tiktok.com' ||
          host.endsWith('.tiktok.com')
        )
      ) {
        return NextResponse.json(
          { error: 'Only TikTok and YouTube video links are accepted.' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Unknown task type.' },
        { status: 400 }
      );
    }

    if (body.proofUrl && !validPublicUrl(body.proofUrl)) {
      return NextResponse.json(
        { error: 'Proof link must be a valid HTTPS URL.' },
        { status: 400 }
      );
    }

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('telegram_id, username')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (playerError || !player) {
      return NextResponse.json(
        { error: 'Player account not found. Reopen STREET LIFE through Telegram.' },
        { status: 404 }
      );
    }

    // Telegram membership tasks: verify with Telegram, then credit using
    // the database RPC so the submission and coin credit happen atomically.
    if (telegramTask?.telegramChat) {
      const isMember = await verifyTelegramMembership(
        telegramTask.telegramChat,
        user.id
      );

      if (!isMember) {
        return NextResponse.json(
          {
            error: `Membership not found in ${telegramTask.telegramChat}. Join it, then tap Verify again.`,
          },
          { status: 403 }
        );
      }

      const { data: creditResult, error: creditError } =
        await supabase.rpc('complete_streetlife_telegram_task', {
          p_player_telegram_id: telegramId,
          p_player_username:
            player.username ||
            (user.username ? `@${user.username}` : `Telegram ${telegramId}`),
          p_task_key: taskKey,
          p_platform: 'Telegram',
          p_proof_url: `https://t.me/${telegramTask.telegramChat.replace(/^@/, '')}`,
          p_reward: telegramTask.reward,
        });

      if (creditError) throw creditError;

      const result = Array.isArray(creditResult)
        ? creditResult[0]
        : creditResult;

      if (!result?.success) {
        return NextResponse.json(
          { error: result?.message || 'This Telegram task could not be credited.' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          id: result.submission_id,
          status: 'approved',
          autoVerified: true,
          credited: result.credited,
          message: result.message,
        },
        { status: 200 }
      );
    }

    // Prevent duplicate pending or approved submissions for one-time tasks.
    if (TASKS[taskKey] || taskType === 'video') {
      const { data: previous, error: previousError } = await supabase
        .from('task_submissions')
        .select('id, status')
        .eq('player_telegram_id', telegramId)
        .eq('task_key', taskKey)
        .in('status', ['pending', 'approved'])
        .limit(1);

      if (previousError) throw previousError;

      if (previous?.some((item) => item.status === 'approved')) {
        return NextResponse.json(
          { error: 'This task has already been approved.' },
          { status: 409 }
        );
      }

      if (previous?.some((item) => item.status === 'pending')) {
        return NextResponse.json(
          { error: 'This task is already waiting for admin review.' },
          { status: 409 }
        );
      }
    }

    // Enforce daily limits on the server, not only in the player interface.
    if (taskType === 'status_post' || taskType === 'boost') {
      const since = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();

      const { count, error: countError } = await supabase
        .from('task_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('player_telegram_id', telegramId)
        .eq('task_type', taskType)
        .neq('status', 'rejected')
        .gte('submitted_at', since);

      if (countError) throw countError;

      const limit = taskType === 'status_post' ? 2 : 3;

      if ((count || 0) >= limit) {
        return NextResponse.json(
          { error: `Daily limit reached: maximum ${limit} submissions per 24 hours.` },
          { status: 429 }
        );
      }
    }

    // External tasks are stored as pending. They do not receive coins here.
    const row = {
      player_telegram_id: telegramId,
      player_username:
        user.username
          ? `@${user.username}`
          : [user.first_name, user.last_name].filter(Boolean).join(' ') ||
            `Telegram ${telegramId}`,
      task_key: taskKey,
      task_type: dbTaskType,
      platform:
        typeof body.platform === 'string'
          ? body.platform.slice(0, 40)
          : null,
      proof_url:
        typeof body.proofUrl === 'string'
          ? body.proofUrl.slice(0, 2000)
          : null,
      screenshot_urls: screenshots,
      reward,
      status: 'pending',
    };

    const { data, error } = await supabase
      .from('task_submissions')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This task already has a pending or approved submission.' },
          { status: 409 }
        );
      }

      throw error;
    }

    return NextResponse.json(
      { ok: true, id: data.id, status: 'pending' },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/tasks:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not submit task proof. Please try again.',
      },
      { status: 500 }
    );
  }
}
