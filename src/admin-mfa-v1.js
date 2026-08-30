(function(global){
'use strict';

const FACTOR_LABEL='Astraeon Admin Studio';
const TOTP_CODE=/^\d{6}$/;

function message(error,fallback='Não foi possível concluir a verificação MFA.'){
  const text=String(error?.message||error||fallback);
  return text.replace(/[\r\n]+/g,' ').slice(0,180)||fallback;
}

function requireMfa(client){
  if(!client?.auth?.mfa)throw new Error('mfa_unavailable');
  return client.auth.mfa;
}

function allFactors(data){
  const listed=Array.isArray(data?.all)?data.all:[
    ...(Array.isArray(data?.totp)?data.totp:[]),
    ...(Array.isArray(data?.phone)?data.phone:[])
  ];
  const seen=new Set();
  return listed.filter(factor=>{
    if(!factor?.id||seen.has(factor.id))return false;
    seen.add(factor.id);
    return true;
  });
}

async function inspect(client){
  const mfa=requireMfa(client);
  const [aalResult,factorsResult]=await Promise.all([
    mfa.getAuthenticatorAssuranceLevel(),
    mfa.listFactors()
  ]);
  if(aalResult?.error)throw aalResult.error;
  if(factorsResult?.error)throw factorsResult.error;
  const factors=allFactors(factorsResult?.data);
  const verified=factors.filter(factor=>factor.status==='verified');
  const pending=factors.filter(factor=>factor.status!=='verified');
  const currentLevel=aalResult?.data?.currentLevel||'aal1';
  const nextLevel=aalResult?.data?.nextLevel||'aal1';
  if(currentLevel==='aal2')return{state:'verified',currentLevel,nextLevel,factors,verified,pending};
  if(verified.length)return{state:'challenge',currentLevel,nextLevel,factors,verified,pending,factor:verified[0]};
  if(pending.length)return{state:'pending',currentLevel,nextLevel,factors,verified,pending,factor:pending[0]};
  return{state:'enroll',currentLevel,nextLevel,factors,verified,pending};
}

async function enrollTotp(client){
  const {data,error}=await requireMfa(client).enroll({factorType:'totp',friendlyName:FACTOR_LABEL});
  if(error)throw error;
  if(!data?.id||!data?.totp?.qr_code)throw new Error('mfa_enrollment_incomplete');
  return{
    id:data.id,
    type:data.type||'totp',
    friendlyName:data.friendly_name||FACTOR_LABEL,
    qrCode:data.totp.qr_code
  };
}

async function verifyCode(client,factorId,code){
  const normalized=String(code||'').trim();
  if(!TOTP_CODE.test(normalized))throw new Error('Informe o código de seis dígitos do autenticador.');
  const mfa=requireMfa(client);
  const {data:challenge,error:challengeError}=await mfa.challenge({factorId});
  if(challengeError)throw challengeError;
  if(!challenge?.id)throw new Error('mfa_challenge_unavailable');
  const {data,error}=await mfa.verify({factorId,challengeId:challenge.id,code:normalized});
  if(error)throw error;
  return data||{};
}

async function removeFactor(client,factorId){
  const {error}=await requireMfa(client).unenroll({factorId});
  if(error)throw error;
}

global.AstraeonAdminMfaV1=Object.freeze({
  inspect,
  enrollTotp,
  verifyCode,
  removeFactor,
  message
});
})(window);
