import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createSupabaseServiceClient, verifyTelegramInitData } from '@/lib/taskAuth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function hashDevice(id:string){const secret=process.env.STREETLIFE_DEVICE_WALLET_SECRET;if(!secret||secret.length<32)throw new Error('Wallet secret is not configured.');return crypto.createHmac('sha256',secret).update(id).digest('hex');}
export async function POST(request:Request){
 try{
  const body=await request.json().catch(()=>null);
  const user=verifyTelegramInitData(typeof body?.initData==='string'?body.initData:request.headers.get('x-telegram-init-data')||'');
  const deviceId=typeof body?.deviceId==='string'?body.deviceId:'';
  const token=typeof body?.token==='string'?body.token.trim():'';
  if(!/^[A-Za-z0-9_-]{20,100}$/.test(deviceId)||!/^[a-f0-9]{64}$/i.test(token))
   return NextResponse.json({error:'This referral link is invalid. Please ask your friend for a new link.'},{status:400});
  const supabase=createSupabaseServiceClient();
  const {data,error}=await supabase.rpc('claim_device_referral',{
   p_invitee_telegram_id:user.id,
   p_invitee_device_key_hash:hashDevice(deviceId),
   p_token_hash:crypto.createHash('sha256').update(token).digest('hex'),
  });
  if(error){console.error('Device referral claim failed:',error);return NextResponse.json({error:'Referral service is temporarily unavailable.'},{status:503});}
  const result=Array.isArray(data)?data[0]:data;
  if(!result?.success)return NextResponse.json({success:false,message:result?.message||'Referral could not be applied.'},{status:409});
  return NextResponse.json({success:true,message:result.message,inviteeBonus:Number(result.invitee_bonus||0),balance:Number(result.invitee_balance||0),referralsCount:Number(result.referrals_count||0)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const message=e instanceof Error?e.message:'Telegram verification failed.';return NextResponse.json({error:message},{status:401});}
}