/* Optional email-code UX over the official Supabase Auth client. No requests on construction. */
(function(scope){'use strict';
  function createSession(auth) {
    const error = (code,message) => Object.assign(new Error(message),{code});
    const email = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    async function requestCode(value) {
      if (!email(value)) throw error('invalid_email','メールアドレスを確認してください');
      const {error:e} = await auth.signInWithOtp({email:value.trim(),options:{shouldCreateUser:true}});
      if (e) throw error('otp_failed','確認コードを送信できません 少し待って再度お試しください');
      return true;
    }
    async function verifyCode(value,token) {
      if (!email(value) || typeof token !== 'string' || !/^\d{6}$/.test(token.trim())) throw error('invalid_code','メールアドレスと 6 桁のコードを確認してください');
      const {data,error:e} = await auth.verifyOtp({email:value.trim(),token:token.trim(),type:'email'});
      if (e || !data?.session) throw error('otp_failed','コードを確認できません 有効期限をご確認ください');
      return getUser();
    }
    async function getUser() {
      const {data,error:e} = await auth.getUser();
      // Server verification, not local session metadata, determines whether the UI is signed in.
      if (e || !data?.user?.id) return null;
      return {id:data.user.id};
    }
    async function getAccessToken() {
      const {data,error:e} = await auth.getSession();
      // Only forwarded as a bearer credential. Never use locally decoded claims for authority.
      if (e || !data?.session?.access_token) return null;
      return data.session.access_token;
    }
    async function signOut() {
      const {error:e} = await auth.signOut({scope:'local'});
      if (e) throw error('signout_failed','ログアウトを完了できません 通信をご確認ください');
      return true;
    }
    return Object.freeze({requestCode,verifyCode,getUser,getAccessToken,signOut});
  }
  scope.LanternCloudAuth=Object.freeze({createSession});
  if(typeof module!=='undefined'&&module.exports)module.exports=scope.LanternCloudAuth;
})(typeof window!=='undefined'?window:globalThis);
