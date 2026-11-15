import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createSupabaseServiceClient, verifyTelegramInitData } from '@/lib/taskAuth';
import { randomBytes } from 'node:crypto';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function hashDevice(id:string){const secret=process.env.STREETLIFE_DEVICE_WALLET_SECRET;if(!secret||secret.length<32)throw new Error('Wallet secret is not configured.');return crypto.createHmac('sha256',secret).update(id).digest('hex');}
export async function POST(request:Request){
 try{
  const body=await request.json().catch(()=>null);
  const user=verifyTelegramInitData(typeof body?.initData==='string'?body.initData:request.headers.get('x-telegram-init-data')||'');
  const deviceId=typeof body?.deviceId==='string'?body.deviceId:'';
  if(!/^[A-Za-z0-9_-]{20,100}$/.test(deviceId))return NextResponse.json({error:'Invalid device identity.'},{status:400});
  const token=randomBytes(32).toString('hex');
  const tokenHash=crypto.createHash('sha256').update(token).digest('hex');
  const supabase=createSupabaseServiceClient();
  const {data,error}=await supabase.rpc('create_device_referral_link',{p_telegram_id:user.id,p_device_key_hash:hashDevice(deviceId),p_token_hash:tokenHash});
  if(error)throw error;
  const bot='Streetlifebot_bot';
  return NextResponse.json({link:`https://t.me/${bot}?startapp=${token}`,token},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Create referral link failed',e);return NextResponse.json({error:'Could not create a device-specific referral link.'},{status:503});}
}