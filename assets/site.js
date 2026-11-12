// 有限会社 仁方大森マリーナー 共通スクリプト（index.html / kaitori.html）
(function () {
    // スマホメニューの開閉
    const menuBtn = document.getElementById('menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-icon');
    if (menuBtn && mobileMenu) {
        const setMenu = (open) => {
            mobileMenu.classList.toggle('hidden', !open);
            menuBtn.setAttribute('aria-expanded', String(open));
            menuIcon.className = open ? 'fa-solid fa-xmark text-2xl' : 'fa-solid fa-bars text-2xl';
        };
        menuBtn.addEventListener('click', () => setMenu(mobileMenu.classList.contains('hidden')));
        mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    }

    const form = document.getElementById('contact-form');
    if (!form) return;

    // 「相談する」ボタンから来たら、ご相談の種類・プランを自動で選択
    const topicSel = document.getElementById('form-topic');
    const planSel = document.getElementById('form-plan');
    const planField = document.getElementById('plan-field');
    const syncPlanField = () => {
        if (planField) planField.classList.toggle('hidden', topicSel.value !== '空き家管理');
    };
    topicSel.addEventListener('change', syncPlanField);
    document.querySelectorAll('a[data-topic]').forEach((link) => {
        link.addEventListener('click', () => {
            topicSel.value = link.dataset.topic;
            if (planSel) planSel.value = link.dataset.plan || '';
            syncPlanField();
        });
    });
    syncPlanField();

    // フォーム送信（FormSubmit）
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const invalid = document.getElementById('form-invalid');
        const toastSuccess = document.getElementById('toast-success');
        const toastError = document.getElementById('toast-error');
        [invalid, toastSuccess, toastError].forEach((el) => el.classList.add('hidden'));

        if (!form.checkValidity()) {
            invalid.classList.remove('hidden');
            form.querySelector(':invalid').focus();
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '送信中… <i class="fa-solid fa-spinner animate-spin ml-2"></i>';

        const v = (id) => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        };
        const topic = v('form-topic');
        try {
            const response = await fetch('https://formsubmit.co/ajax/marina.oomori1@gmail.com', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    'ご相談の種類': topic,
                    'ご希望のプラン': topic === '空き家管理' ? (v('form-plan') || '未定') : '-',
                    'お名前': v('form-name'),
                    '電話番号': v('form-phone'),
                    'メールアドレス': v('form-email') || '未入力',
                    '物件の所在地': v('form-address') || '未入力',
                    'ご相談内容': v('form-msg') || '未入力',
                    '送信元ページ': document.title,
                    '_subject': '【HPお問い合わせ｜' + topic + '】有限会社 仁方大森マリーナー',
                    '_template': 'table',
                    '_honey': v('form-honey')
                })
            });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            form.reset();
            syncPlanField();
            toastSuccess.classList.remove('hidden');
        } catch (error) {
            console.error('Submission error:', error);
            toastError.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });
})();
