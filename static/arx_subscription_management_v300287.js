/* ARX V300.287 — subscriber self-service. No browser-side Paddle API credentials. */
(function () {
  'use strict';
  const messages = {
    en: ['Manage subscription', 'Current plan', 'Billing', 'Change to this plan', 'Preview price', 'Confirm change and authorize charge', 'Cancel at renewal', 'Keep subscription', 'Your current plan', 'You are not the purchasing account', 'Review the exact Paddle amount before confirming.', 'Paddle payment pending. The plan changes after confirmation.', 'A new quote is required. Please try again.', 'This change cannot be completed. Contact support.', 'Amount due now', 'Next bill', 'Future recurring', 'Cancellation scheduled. Access remains until period end.', 'Choose a different plan or billing period.', 'Manage billing is temporarily unavailable.', 'I understand Premium+ access ends immediately and any credit is applied to my next invoice.', 'Are you sure you want to cancel at the end of the paid period?', 'Monthly', 'Yearly'],
    tr: ['Aboneliği yönet', 'Mevcut paket', 'Faturalama', 'Bu pakete geç', 'Ücreti önizle', 'Ücreti onayla ve planı değiştir', 'Dönem sonunda iptal et', 'İptali geri al', 'Mevcut paketiniz', 'Satın alan Discord hesabı ile giriş yapın', 'Onaylamadan önce Paddle tarafından hesaplanan tutarı inceleyin.', 'Ödeme doğrulanıyor. Plan, Paddle bildirimiyle güncellenecek.', 'Ücret veya abonelik değişti. Yeni önizleme alın.', 'İşlem tamamlanamadı. Destek ile iletişime geçin.', 'Şimdi ödenecek', 'Sonraki ödeme', 'Yenileme tutarı', 'İptal planlandı. Haklar dönem sonuna kadar devam eder.', 'Farklı paket veya ödeme dönemi seçin.', 'Abonelik yönetimi şu anda kullanılamıyor.', 'Premium+ haklarımın hemen sona ereceğini ve kalan tutarın sonraki faturaya yansıyacağını kabul ediyorum.', 'Ücretini ödediğiniz dönemin sonunda iptal etmek istiyor musunuz?', 'Aylık', 'Yıllık'],
    fr: ['Gérer l’abonnement','Offre actuelle','Facturation','Changer pour cette offre','Afficher le montant','Confirmer et autoriser le paiement','Annuler à échéance','Annuler la résiliation','Votre offre actuelle','Connectez-vous avec le compte acheteur','Vérifiez le montant calculé par Paddle.','Paiement en attente de confirmation.','Le tarif a changé. Demandez un nouveau devis.','Opération impossible. Contactez le support.','À payer maintenant','Prochain paiement','Montant récurrent','Résiliation programmée. Accès maintenu jusqu’à échéance.','Choisissez une autre offre ou période.','Gestion indisponible.','Je comprends que Premium+ prend fin immédiatement et que le crédit sera appliqué à la prochaine facture.','Confirmer la résiliation en fin de période ?','Mensuel','Annuel'],
    es: ['Gestionar suscripción','Plan actual','Facturación','Cambiar a este plan','Ver importe','Confirmar y autorizar cobro','Cancelar al renovar','Deshacer cancelación','Su plan actual','Inicie sesión con la cuenta compradora','Revise el importe calculado por Paddle.','Pago pendiente de confirmación.','El precio ha cambiado. Obtenga otra vista previa.','No se pudo completar. Contacte con soporte.','Cobro inmediato','Próximo cobro','Importe recurrente','Cancelación programada. Acceso hasta fin de periodo.','Elija otro plan o periodo.','Gestión no disponible.','Entiendo que Premium+ termina inmediatamente y que el crédito se aplicará a la próxima factura.','¿Cancelar al final del periodo pagado?','Mensual','Anual'],
    de: ['Abonnement verwalten','Aktueller Tarif','Abrechnung','Zu diesem Tarif wechseln','Betrag prüfen','Änderung und Zahlung bestätigen','Zum Laufzeitende kündigen','Kündigung zurücknehmen','Ihr aktueller Tarif','Mit dem Käuferkonto anmelden','Prüfen Sie den von Paddle berechneten Betrag.','Zahlungsbestätigung ausstehend.','Betrag geändert. Neue Vorschau anfordern.','Vorgang nicht möglich. Support kontaktieren.','Jetzt fällig','Nächste Zahlung','Regelmäßiger Betrag','Kündigung vorgemerkt. Zugriff bis Laufzeitende.','Anderen Tarif oder Zeitraum wählen.','Verwaltung nicht verfügbar.','Mir ist bewusst, dass Premium+ sofort endet und die Gutschrift mit der nächsten Rechnung verrechnet wird.','Zum Ende des bezahlten Zeitraums kündigen?','Monatlich','Jährlich'],
    ar: ['إدارة الاشتراك','الخطة الحالية','الفوترة','التبديل إلى هذه الخطة','معاينة المبلغ','تأكيد التغيير والدفع','الإلغاء عند التجديد','التراجع عن الإلغاء','خطتك الحالية','سجّل الدخول بحساب المشتري','راجع المبلغ المحسوب بواسطة Paddle.','بانتظار تأكيد الدفع.','تغير المبلغ، يرجى طلب معاينة جديدة.','تعذر إتمام العملية. تواصل مع الدعم.','المستحق الآن','الدفعة التالية','الرسوم المتكررة','تمت جدولة الإلغاء مع استمرار الوصول حتى نهاية المدة.','اختر خطة أو فترة مختلفة.','إدارة الاشتراك غير متاحة.','أفهم أن مزايا Premium+ تنتهي فورًا وأن الرصيد سيُحتسب في الفاتورة التالية.','هل تريد الإلغاء في نهاية المدة المدفوعة؟','شهري','سنوي'],
    pt: ['Gerir subscrição','Plano atual','Faturação','Mudar para este plano','Pré-visualizar valor','Confirmar alteração e cobrança','Cancelar na renovação','Anular cancelamento','Plano atual','Entre com a conta do comprador','Verifique o valor calculado pelo Paddle.','Pagamento a aguardar confirmação.','O valor mudou. Solicite nova pré-visualização.','Não foi possível concluir. Contacte o suporte.','A pagar agora','Próximo pagamento','Valor recorrente','Cancelamento agendado. Acesso até ao fim do período.','Escolha outro plano ou período.','Gestão indisponível.','Entendo que o Premium+ termina imediatamente e o crédito será aplicado à próxima fatura.','Cancelar no final do período pago?','Mensal','Anual'],
    ja: ['サブスクリプション管理','現在のプラン','請求周期','このプランに変更','料金を確認','変更と請求を承認','更新時に解約','解約を取り消す','現在のプランです','購入したアカウントでログインしてください','Paddle が計算した金額をご確認ください。','決済確認待ちです。','金額が変わりました。再確認してください。','操作できません。サポートへご連絡ください。','今すぐ支払う金額','次回請求','継続課金額','解約予約済み。期間終了まで利用できます。','別のプランまたは請求周期を選択してください。','管理を利用できません。','Premium+ の特典が直ちに終了し、差額は次回の請求に充当されることを理解しました。','支払い済み期間の終了時に解約しますか？','月額','年額'],
    ru: ['Управление подпиской','Текущий план','Период оплаты','Перейти на этот план','Просмотреть сумму','Подтвердить смену и оплату','Отменить при продлении','Отменить отмену','Ваш текущий план','Войдите в аккаунт покупателя','Проверьте сумму, рассчитанную Paddle.','Ожидается подтверждение оплаты.','Цена изменилась. Запросите новый расчёт.','Операция не удалась. Обратитесь в поддержку.','Списать сейчас','Следующий платёж','Регулярный платёж','Отмена запланирована. Доступ до конца периода.','Выберите другой план или период.','Управление недоступно.','Я понимаю, что Premium+ отключится сразу, а остаток учтут в следующем счёте.','Отменить по окончании оплаченного периода?','Ежемесячно','Ежегодно'],
    ko: ['구독 관리','현재 요금제','결제 주기','이 요금제로 변경','금액 미리보기','변경 및 결제 승인','갱신 시 취소','취소 철회','현재 요금제입니다','구매 계정으로 로그인하세요','Paddle에서 계산한 금액을 확인하세요.','결제 확인 대기 중입니다.','금액이 변경되었습니다. 다시 확인하세요.','작업을 완료할 수 없습니다. 지원팀에 문의하세요.','지금 결제','다음 결제','정기 결제','취소가 예약되었습니다. 기간 종료까지 이용 가능합니다.','다른 요금제 또는 주기를 선택하세요.','구독 관리가 불가능합니다.','Premium+ 이용 권한이 즉시 종료되며 잔액이 다음 청구서에 반영됨을 이해합니다.','결제 기간 종료 시 취소하시겠습니까?','월간','연간'],
    'pt-BR': ['Gerenciar assinatura','Plano atual','Cobrança','Mudar para este plano','Visualizar valor','Confirmar alteração e cobrança','Cancelar na renovação','Desfazer cancelamento','Seu plano atual','Entre com a conta compradora','Confira o valor calculado pela Paddle.','Pagamento aguardando confirmação.','O valor mudou. Solicite nova prévia.','Não foi possível concluir. Contate o suporte.','Cobrança agora','Próxima cobrança','Valor recorrente','Cancelamento agendado. Acesso até o fim do período.','Escolha outro plano ou período.','Gerenciamento indisponível.','Entendo que o Premium+ termina imediatamente e o crédito será aplicado à próxima fatura.','Cancelar ao final do período pago?','Mensal','Anual'],
    pl: ['Zarządzaj subskrypcją','Obecny plan','Rozliczenie','Zmień na ten plan','Sprawdź kwotę','Potwierdź zmianę i płatność','Anuluj przy odnowieniu','Cofnij anulowanie','To Twój obecny plan','Zaloguj się na konto kupującego','Sprawdź kwotę wyliczoną przez Paddle.','Oczekiwanie na potwierdzenie płatności.','Kwota się zmieniła. Pobierz nową wycenę.','Nie udało się. Skontaktuj się z pomocą.','Do zapłaty teraz','Następna płatność','Opłata cykliczna','Anulowanie zaplanowane. Dostęp do końca okresu.','Wybierz inny plan lub okres.','Zarządzanie niedostępne.','Rozumiem, że Premium+ kończy się natychmiast, a pozostała kwota trafi na kolejną fakturę.','Anulować na końcu opłaconego okresu?','Miesięcznie','Rocznie'],
    it: ['Gestisci abbonamento','Piano attuale','Fatturazione','Passa a questo piano','Anteprima importo','Conferma modifica e addebito','Annulla al rinnovo','Ripristina abbonamento','Il tuo piano attuale','Accedi con l’account acquirente','Controlla l’importo calcolato da Paddle.','Pagamento in attesa di conferma.','L’importo è cambiato. Richiedi un nuovo preventivo.','Operazione non riuscita. Contatta il supporto.','Da pagare ora','Prossimo pagamento','Importo ricorrente','Annullamento programmato. Accesso fino alla scadenza.','Scegli un altro piano o periodo.','Gestione non disponibile.','Comprendo che Premium+ termina subito e il credito sarà applicato alla prossima fattura.','Annullare alla fine del periodo pagato?','Mensile','Annuale'],
    'sv-SE': ['Hantera prenumeration','Nuvarande plan','Fakturering','Byt till denna plan','Visa belopp','Bekräfta byte och betalning','Avsluta vid förnyelse','Ångra uppsägning','Din nuvarande plan','Logga in med köparkontot','Kontrollera beloppet som Paddle beräknat.','Betalningen väntar på bekräftelse.','Beloppet har ändrats. Hämta ny förhandsvisning.','Kunde inte slutföras. Kontakta supporten.','Betala nu','Nästa betalning','Återkommande belopp','Uppsägning schemalagd. Åtkomst till periodens slut.','Välj en annan plan eller period.','Hantering ej tillgänglig.','Jag förstår att Premium+ upphör direkt och att krediten dras av på nästa faktura.','Avsluta vid slutet av betald period?','Månadsvis','Årsvis'],
    nl: ['Abonnement beheren','Huidig pakket','Facturering','Naar dit pakket wijzigen','Bedrag bekijken','Wijziging en betaling bevestigen','Opzeggen bij verlenging','Opzegging intrekken','Uw huidige pakket','Meld aan met het kopersaccount','Controleer het door Paddle berekende bedrag.','Betaling wacht op bevestiging.','Het bedrag is gewijzigd. Vraag een nieuw overzicht aan.','Niet mogelijk. Neem contact op met ondersteuning.','Nu te betalen','Volgende betaling','Terugkerend bedrag','Opzegging gepland. Toegang tot einde betaalperiode.','Kies een ander pakket of periode.','Beheer niet beschikbaar.','Ik begrijp dat Premium+ direct eindigt en dat het tegoed op de volgende factuur wordt verrekend.','Opzeggen aan het einde van de betaalperiode?','Maandelijks','Jaarlijks']
  };
  const lang = document.documentElement.lang;
  const m = messages[lang] || messages.en;
  const dialog = document.getElementById('arxPurchaseDialog');
  if (!dialog) return;
  // Purchasing remains possible on the premium cards; cancellation is managed
  // separately outside this window, never in the sales funnel.
  const subscribeLabels = {
    en:'Subscribe', tr:'Abonelik', fr:"S'abonner", es:'Suscribirse',
    de:'Abonnieren', ar:'اشترك', pt:'Subscrever', ja:'申し込む',
    ru:'Оформить подписку', ko:'구독하기', 'pt-BR':'Assinar',
    pl:'Subskrybuj', it:'Abbonati', 'sv-SE':'Prenumerera', nl:'Abonneren'
  };
  document.querySelectorAll('.arx-existing-subscription .button-label').forEach(el => {
    el.textContent = subscribeLabels[lang] || subscribeLabels.en;
  });
  const grid = dialog.querySelector('.arx-purchase-grid');
  if (!grid) return;
  const panel = document.createElement('section');
  panel.className = 'arx-subscription-selfservice';
  panel.setAttribute('aria-live', 'polite');
  panel.hidden = true;
  panel.style.cssText = 'padding:13px;border:1px solid #464b58;border-radius:12px;margin-bottom:15px;background:#15171d;color:#fafafa';
  grid.before(panel);
  let guild = '', state = null, quote = null, loading = false, generation = 0;
  const allowed = {
    'pro:monthly':['pro:yearly','premium_plus:monthly','premium_plus:yearly'],
    'pro:yearly':['premium_plus:yearly'],
    'premium_plus:monthly':['premium_plus:yearly'],
    'premium_plus:yearly':[]
  };
  const bonusLabels = {
    en:['Bonus','days'],tr:['Bonus','gün'],fr:['Bonus','jours'],es:['Bonificación','días'],
    de:['Bonus','Tage'],ar:['مكافأة','أيام'],pt:['Bónus','dias'],ja:['ボーナス','日'],
    ru:['Бонус','дней'],ko:['보너스','일'], 'pt-BR':['Bônus','dias'],pl:['Bonus','dni'],
    it:['Bonus','giorni'],'sv-SE':['Bonus','dagar'],nl:['Bonus','dagen']
  };
  function line(text) { const p=document.createElement('p');p.textContent=text;panel.append(p);return p; }
  function btn(label,action) { const b=document.createElement('button');b.type='button';b.className='arx-purchase-buy';
    b.style.cssText='margin:8px 8px 4px 0;min-width:130px';b.textContent=label;b.addEventListener('click',action);panel.append(b);return b; }
  function price(totals) { if(!totals)return '—'; const [minor,code]=totals;
    try {const fmt=new Intl.NumberFormat(lang,{style:'currency',currency:code});
      return fmt.format(Number(minor)/Math.pow(10,fmt.resolvedOptions().maximumFractionDigits));}
    catch (_) {return String(minor)+' '+code;}
  }
  function bonus(seconds){ const terms=bonusLabels[lang]||bonusLabels.en;
    return terms[0]+': '+new Intl.NumberFormat(lang,{maximumFractionDigits:3}).format(Number(seconds)/86400)+' '+terms[1];
  }
  function currentPeriod(){return dialog.querySelector('[data-arx-period][aria-pressed="true"]')?.dataset.arxPeriod||'monthly';}
  function availability(){
    const period=currentPeriod();
    dialog.querySelectorAll('[data-arx-buy-plan]').forEach(button=>{
      const plan=button.dataset.arxBuyPlan;
      const allowedForCurrent = state?.kind === 'paddle' &&
        (allowed[String(state.plan)+':'+String(state.period)]||[]).includes(plan+':'+period);
      const manual = state?.kind==='manual' && state.checkout_allowed;
      const current = (state?.kind==='paddle' || manual) && plan===state.plan && period===(state.period||'monthly');
      if(state?.kind==='paddle' && !state.can_repurchase){
        button.disabled=!state.owner || !state.management_enabled || !!state.scheduled_change ||
          (state.status!=='active') || !allowedForCurrent;
        button.textContent=current?m[8]:m[3];
        button.title=current?m[8]:(!state.owner?m[9]:(button.disabled?m[18]:''));
      } else if(manual){
        const eligible = (state.allowed_targets||[]).includes(plan+':'+period);
        // The regular new-subscription checkout still needs a configured price.
        const options = JSON.parse(document.getElementById('arxPurchaseConfig').textContent);
        const configured = !!(options.checkoutEnabled && (options.offers||[]).some(
          o=>o.plan===plan&&o.period===period));
        button.disabled=!eligible||!configured||current;
        button.textContent=current?m[8]:m[3];
        button.title=current?m[8]:(button.disabled?m[18]:'');
      } else if(state?.kind==='manual'){
        button.disabled=true;button.title=m[19];
      }
    });
  }
  function render(){
    panel.replaceChildren();quote=null;
    if(!state || state.kind==='free'||state.can_repurchase){panel.hidden=true;return;}
    panel.hidden=false;
    const h=document.createElement('strong');h.textContent=m[1];panel.append(h);
    line((state.plan==='premium_plus'?'Premium+':state.plan==='pro'?'Premium':String(state.plan||''))+(state.period?' / '+(state.period==='yearly'?m[23]:m[22]):''));
    if(state.ends_at){try{line(new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeStyle:'short'}).format(new Date(/(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(state.ends_at)?state.ends_at:state.ends_at.replace(' ','T')+'Z')));}catch(_){/* no untrusted markup */}}
    if(state.kind==='manual'){
      if(state.checkout_allowed){line(m[18]);return;}
      line(m[19]);return;
    }
    if(!state.owner){line(m[9]);return;}
    if(!state.management_enabled || state.scheduled_change){line(m[19]);return;}
  }
  async function call(route,payload={},method='POST'){
    const opts={credentials:'same-origin',cache:'no-store',headers:{'Accept':'application/json'}};
    if(method==='POST'){opts.method='POST';opts.headers['Content-Type']='application/json';opts.body=JSON.stringify({guild_id:guild,...payload});}
    const res=await fetch('/api/billing/manage/'+route+(method==='GET'?'?guild_id='+encodeURIComponent(guild):''),opts);
    const data=await res.json();if(!res.ok)throw Error(data.error||'http_'+res.status);return data;
  }
  function errorMessage(error){const code=String(error?.message||'');
    if(code.includes('quote_')||code.includes('sync_')||code.includes('changed_'))line(m[12]);
    else line(m[13]+' ('+code.slice(0,90)+')');
  }
  async function loadFor(gid){guild=gid;const gen=++generation;state=null;quote=null;
    // The generic checkout handler must not re-enable subscriber buttons while
    // ownership and the authoritative plan status are being fetched.
    dialog.dataset.arxBillingGate='loading';
    panel.hidden=false;panel.replaceChildren();line(m[1]+'…');
    dialog.querySelectorAll('[data-arx-buy-plan]').forEach(b=>b.disabled=true);
    try{
      const next=await call('status',{},'GET');if(gen!==generation)return;
      state=next;
      if(next.kind==='free'||next.can_repurchase ||
          (next.kind==='manual' && next.checkout_allowed)){
        dialog.dataset.arxBillingGate='checkout';
        dialog.dispatchEvent(new Event('arx:checkout-refresh'));
      } else {
        dialog.dataset.arxBillingGate='subscriber';
      }
      render();availability();
    } catch(e){
      if(gen!==generation)return;
      dialog.dataset.arxBillingGate='error';
      panel.replaceChildren();errorMessage(e);
      dialog.querySelectorAll('[data-arx-buy-plan]').forEach(b=>b.disabled=true);
    }
  }
  // Generic checkout refreshes labels/availability after an intent completes.
  // Reapply the authoritative current-guild plan constraints immediately,
  // rather than allowing the ordinary Buy label to leak onto an active plan.
  dialog.addEventListener('arx:purchase-view-updated',()=>{
    if(state && guild && String(dialog.dataset.arxBillingGuild||'')===String(guild))
      availability();
  });
  // Handle billing-period switches after the generic checkout script's
  // target listener updates aria-pressed and pricing, not in capture phase.
  dialog.addEventListener('click',event=>{
    if(event.target?.closest?.('[data-arx-period]'))availability();
  });
  // Openers run in the bubble phase, after the ordinary checkout handler
  // has selected and opened the new guild's dialog. This avoids a fast status
  // response being overwritten by the old target handler's loading state.
  document.addEventListener('click',(event)=>{
    const opener=event.target?.closest?.('.arx-premium-checkout[data-guild-id]');
    if(opener)loadFor(opener.dataset.guildId);
  });
  // Keep purchase interception in capture phase to block accidental second
  // Paddle subscriptions before the generic checkout handler runs.
  document.addEventListener('click',(event)=>{
    const buy=event.target?.closest?.('#arxPurchaseDialog [data-arx-buy-plan]');
    if(!buy)return;
    if(state && (state.kind==='free'||state.can_repurchase ||
        (state.kind==='manual' && state.checkout_allowed &&
          (state.allowed_targets||[]).includes(buy.dataset.arxBuyPlan+':'+currentPeriod()))))return;
    // Block the original new-subscription checkout for all existing paid plans.
    event.preventDefault();event.stopImmediatePropagation();
    if(!state){panel.hidden=false;panel.replaceChildren();line(m[19]);return;}
    if(state.kind!=='paddle'||!state.owner||!state.management_enabled||loading){
      panel.hidden=false;panel.replaceChildren();line(!state.owner?m[9]:m[19]);return;
    }
    const plan=buy.dataset.arxBuyPlan,period=currentPeriod();
    if(!(allowed[String(state.plan)+':'+String(state.period)]||[]).includes(plan+':'+period))return;
    loading=true;panel.hidden=false;panel.replaceChildren();line(m[10]);
    call('preview',{plan,period}).then(result=>{
      quote=result.quote;panel.replaceChildren();
      const h=document.createElement('strong');h.textContent=m[4]+' — '+(plan==='premium_plus'?'Premium+':'Premium')+' / '+(period==='yearly'?m[23]:m[22]);panel.append(h);
      line(m[14]+': '+price(result.amounts.immediate));
      line(m[15]+': '+price(result.amounts.next));
      line(m[16]+': '+price(result.amounts.recurring));
      line(bonus(result.bonus_seconds_estimate||0));
      line(m[10]);
      btn(m[5],async()=>{if(loading||!quote)return;loading=true;
        try{await call('confirm',{quote});quote=null;panel.replaceChildren();line(m[11]);
          dialog.querySelectorAll('[data-arx-buy-plan]').forEach(b=>b.disabled=true);}
        catch(e){quote=null;panel.replaceChildren();errorMessage(e);}finally{loading=false;}
      });
    }).catch(e=>{panel.replaceChildren();errorMessage(e);}).finally(()=>{loading=false;});
  },true);
})();
