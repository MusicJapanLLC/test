export const ACTIONS = {
  diagnostic_marker:{label:'Diagnostic marker'},
  enforce_https:{label:'HTTPS強制'},
  hsts_profile:{label:'HSTS強化'},
  security_headers_profile:{label:'Security headers'},
  csp_report_only_profile:{label:'CSP Report-Only'},
  csp_enforce_profile:{label:'CSP強制'},
  frame_ancestors_profile:{label:'Frame防御'},
  nosniff_enable:{label:'nosniff'},
  referrer_policy_profile:{label:'Referrer-Policy'},
  permissions_policy_profile:{label:'Permissions-Policy'},
  cookie_security_profile:{label:'Cookie属性強化'},
  cors_allowlist_profile:{label:'CORS allowlist'},
  strip_server_banner:{label:'Server情報削減'},
  mixed_content_rewrite:{label:'Mixed Content修正'},
  security_txt_refresh:{label:'security.txt更新'},
  robots_txt_refresh:{label:'robots.txt整理'},
  sitemap_refresh:{label:'sitemap更新'},
  cache_refresh:{label:'Cache refresh'},
  cache_control_private_profile:{label:'機密ページcache制御'},
  method_allowlist_profile:{label:'HTTP method制限'},
  auth_form_hardening:{label:'認証フォーム修正'},
  sri_profile:{label:'SRI追加'},
  source_map_disable:{label:'Source map公開停止'},
  dependency_upgrade_profile:{label:'依存更新'},
  dns_mail_profile:{label:'SPF / DMARC設定'},
  dns_tls_profile:{label:'CAA設定'},
  tls_certificate_renew:{label:'TLS証明書更新'},
  tls_minimum_profile:{label:'TLS最低version強化'},
  cache_poison_canary:{label:'Cache poison canary'},
  session_revoke_canary:{label:'Test session revoke'},
  feature_flag_canary:{label:'Feature flag flip canary'},
  csrf_state_change_canary:{label:'CSRF state-change canary'},
  webhook_mutation_canary:{label:'Webhook mutation canary'},
  queue_job_canary:{label:'Queue job canary'},
  source_file_cycle:{label:'Source file mutation cycle'},
  write_read_delete_canary:{label:'Write / read / delete canary'},
  cache_purge_canary:{label:'Cache purge canary'}
};

export function candidateActions(id=''){
  if(id==='http-not-upgraded'||id==='password-over-http')return['enforce_https'];
  if(id==='hsts-missing'||id==='hsts-max-age-weak')return['hsts_profile','security_headers_profile'];
  if(id.startsWith('csp-')||id.startsWith('dynamic-code-signal-'))return['csp_report_only_profile','security_headers_profile'];
  if(id==='frame-protection-missing')return['frame_ancestors_profile','security_headers_profile'];
  if(id==='nosniff-missing')return['nosniff_enable','security_headers_profile'];
  if(id==='referrer-policy-missing'||id==='referrer-policy-unsafe')return['referrer_policy_profile','security_headers_profile'];
  if(id==='permissions-policy-missing')return['permissions_policy_profile','security_headers_profile'];
  if(id.startsWith('cookie-'))return['cookie_security_profile','security_headers_profile'];
  if(id.startsWith('tech-disclosure-'))return['strip_server_banner'];
  if(['cors-reflect-credentials','cors-wildcard','cors-null-origin-credentials'].includes(id))return['cors_allowlist_profile'];
  if(id.startsWith('mixed-'))return['mixed_content_rewrite'];
  if(id==='password-form-get'||id==='password-cross-origin')return['auth_form_hardening'];
  if(id.startsWith('third-party-sri-'))return['sri_profile'];
  if(id.startsWith('sourcemap-hint-'))return['source_map_disable'];
  if(id.startsWith('old-jquery-'))return['dependency_upgrade_profile'];
  if(id==='robots-sensitive-hints')return['robots_txt_refresh'];
  if(id.startsWith('security-txt-'))return['security_txt_refresh'];
  if(id==='auth-page-cache-control-weak')return['cache_control_private_profile','cache_refresh'];
  if(id==='http-methods-write-advertised'||id==='trace-method-advertised')return['method_allowlist_profile'];
  if(id==='dns-spf-missing'||id==='dns-dmarc-missing')return['dns_mail_profile'];
  if(id==='dns-caa-missing')return['dns_tls_profile'];
  if(['tls-cert-expired','tls-cert-expiring-soon','tls-certificate-untrusted'].includes(id))return['tls_certificate_renew'];
  if(id==='tls-protocol-legacy')return['tls_minimum_profile'];
  return [];
}

export const ATTACK_CANARY_ACTIONS = new Set([
  'cache_poison_canary',
  'session_revoke_canary',
  'feature_flag_canary',
  'csrf_state_change_canary',
  'webhook_mutation_canary',
  'queue_job_canary',
  'source_file_cycle',
  'write_read_delete_canary',
  'cache_purge_canary'
]);

export const ALLOWED_ACTIONS = new Set(Object.keys(ACTIONS));
