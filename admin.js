(function () {
  var REPO = "PayersRi/Reimbursement", API = "https://api.github.com/repos/" + REPO + "/contents/data.js";
  var $ = function (id) { return document.getElementById(id); };
  var b64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var norm = function (s) { return String(s || "").toLowerCase().replace(/[\u064b-\u065f\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه"); };
  var S = { tok: null, data: null, sha: null, tab: "payers", sel: null, q: "" };

  function unlock(pw) {
    return fetch("gh-key.json?ts=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j) return null;
      return crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]).then(function (base) {
        return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(j.salt), iterations: j.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      }).then(function (key) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(j.iv) }, key, b64(j.ct)); })
        .then(function (p) { return new TextDecoder().decode(p); }, function () { return null; });
    });
  }
  function hdr() { return { authorization: "Bearer " + S.tok, accept: "application/vnd.github+json", "content-type": "application/json" }; }
  function load() {
    return fetch(API + "?ref=main&ts=" + Date.now(), { headers: hdr(), cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("load " + r.status);
      return r.json();
    }).then(function (j) {
      S.sha = j.sha;
      var txt = decodeURIComponent(escape(atob(j.content.replace(/\n/g, ""))));
      S.data = JSON.parse(txt.replace(/^window\.PAYERS=/, "").replace(/;\s*$/, ""));
    });
  }
  function save() {
    var body = { message: "Update payer guide", sha: S.sha, content: btoa(unescape(encodeURIComponent("window.PAYERS=" + JSON.stringify(S.data) + ";"))) };
    return fetch(API, { method: "PUT", headers: hdr(), body: JSON.stringify(body) }).then(function (r) {
      if (r.status === 409 || r.status === 422) return load().then(function () { throw new Error("conflict"); });
      if (!r.ok) throw new Error("save " + r.status);
      return r.json();
    }).then(function (j) { S.sha = j.content.sha; });
  }
  function msg(t, bad) { var m = $("msg"); m.textContent = t; m.className = bad ? "err" : "ok"; m.hidden = !t; }

  function items() {
    var q = norm(S.q), arr = S.tab === "payers" ? S.data.payers : S.data.docs;
    return arr.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) {
      if (S.tab === "notes" && !o.x.note) return false;
      if (!q) return true;
      return norm(JSON.stringify(o.x)).indexOf(q) > -1;
    });
  }
  function renderList() {
    $("tabs").innerHTML = [["payers", "الشركات"], ["docs", "الأوراق المطلوبة"], ["notes", "ملاحظات عاجلة"]].map(function (t) { return '<button type="button" class="chip' + (S.tab === t[0] ? " on active" : "") + '" data-tab="' + t[0] + '">' + t[1] + "</button>"; }).join("");
    $("addBtn").style.display = S.tab === "notes" ? "none" : "";
    $("list").innerHTML = items().map(function (o) {
      var name = S.tab === "payers" ? o.x.name : o.x.type, code = o.x.code || "";
      return '<div class="item" data-i="' + o.i + '"><span dir="auto">' + esc(name) + '</span><span class="muted" dir="ltr">' + esc(code) + "</span></div>";
    }).join("") || '<div class="empty">لا توجد نتائج</div>';
  }
  function ta(id, label, val, ltr) { return '<label for="' + id + '">' + label + '</label><textarea id="' + id + '" class="' + (ltr ? "ltr" : "") + '">' + esc(val) + "</textarea>"; }
  function ri4(k, o, title) {
    o = o || { ce: "", ie: "", ca: "", ia: "" };
    return '<p class="sech">' + title + '</p><div class="grid2">' +
      ta(k + "_ca", "Corporate - عربي", o.ca) + ta(k + "_ce", "Corporate - English", o.ce, 1) +
      ta(k + "_ia", "Individual - عربي", o.ia) + ta(k + "_ie", "Individual - English", o.ie, 1) + "</div>";
  }
  function renderEdit() {
    var e = $("edit"); if (S.sel == null) { e.hidden = true; return; }
    e.hidden = false;
    var h = "";
    if (S.tab === "payers") {
      var p = S.sel === "new" ? { name: "", code: "", ri: null, sub: null } : S.data.payers[S.sel];
      h = '<label for="f_name">اسم الشركة</label><input id="f_name" type="text" dir="auto" value="' + esc(p.name) + '"><label for="f_code">الكود</label><input id="f_code" type="text" dir="ltr" value="' + esc(p.code) + '">' +
        ri4("ri", p.ri, "طريقة الاسترداد") + ri4("sub", p.sub, "التقديم وإعادة التقديم");
    } else {
      var d = S.sel === "new" ? { type: "", code: "", en: "", ar: "", note: "" } : S.data.docs[S.sel];
      h = '<label for="f_type">النوع</label><input id="f_type" type="text" dir="auto" value="' + esc(d.type) + '"><label for="f_code">الكود</label><input id="f_code" type="text" dir="ltr" value="' + esc(d.code) + '">' +
        (S.tab === "docs" ? ta("f_ar", "الأوراق - عربي", d.ar) + ta("f_en", "Documents - English", d.en, 1) : "") +
        ta("f_note", "ملاحظة عاجلة (امسحها عشان تتشال)", d.note, 1);
    }
    h += '<div class="row2"><button class="btn" id="saveBtn" type="button">حفظ</button><button class="btn alt" id="cancelBtn" type="button">إلغاء</button>' + (S.sel !== "new" && S.tab !== "notes" ? '<button class="btn del" id="delBtn" type="button">حذف</button>' : "") + "</div>";
    e.innerHTML = h; e.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  var v = function (id) { return ($(id) ? $(id).value : "").replace(/\r/g, "").trim(); };
  function collect() {
    if (S.tab === "payers") {
      var name = v("f_name"); if (!name) throw new Error("اكتب اسم الشركة");
      var mk = function (k) { var o = { ce: v(k + "_ce"), ie: v(k + "_ie"), ca: v(k + "_ca"), ia: v(k + "_ia") }; return o.ce || o.ie || o.ca || o.ia ? o : null; };
      return { name: name, code: v("f_code"), ri: mk("ri"), sub: mk("sub") };
    }
    var type = v("f_type"); if (!type) throw new Error("اكتب النوع");
    var old = S.sel === "new" ? {} : S.data.docs[S.sel];
    return { type: type, code: v("f_code"), en: S.tab === "docs" ? v("f_en") : (old.en || ""), ar: S.tab === "docs" ? v("f_ar") : (old.ar || ""), note: v("f_note") };
  }
  function commit(label, fn) {
    msg("بيحفظ...");
    var backup = JSON.stringify(S.data);
    try { fn(); } catch (e) { msg(e.message, 1); return; }
    save().then(function () { S.sel = null; msg("اتحفظ ✓ " + label + " (التغيير بيظهر على الصفحة خلال دقيقة تقريبا)"); renderList(); renderEdit(); },
      function (e) { S.data = JSON.parse(backup); msg(e.message === "conflict" ? "حد عدّل في نفس الوقت. اتحدثت البيانات، جرّب تاني." : "الحفظ فشل (" + e.message + "). جرّب تاني.", 1); if (e.message === "conflict") { renderList(); } });
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-tab]"); if (t) { S.tab = t.dataset.tab; S.sel = null; msg(""); renderList(); renderEdit(); return; }
    var it = e.target.closest(".item"); if (it) { S.sel = +it.dataset.i; msg(""); renderEdit(); return; }
    var id = e.target.id;
    if (id === "addBtn") { S.sel = "new"; renderEdit(); }
    else if (id === "cancelBtn") { S.sel = null; renderEdit(); }
    else if (id === "saveBtn") {
      commit("", function () {
        var o = collect(), arr = S.tab === "payers" ? S.data.payers : S.data.docs;
        if (S.sel === "new") arr.push(o); else arr[S.sel] = o;
      });
    } else if (id === "delBtn") {
      if (!confirm("متأكد إنك عايز تحذف؟")) return;
      commit("", function () { (S.tab === "payers" ? S.data.payers : S.data.docs).splice(S.sel, 1); });
    }
  });
  $("q").addEventListener("input", function (e) { S.q = e.target.value; renderList(); });
  function go() {
    var pw = $("pw").value, er = $("lockErr"); er.hidden = true;
    if (!pw) { er.textContent = "اكتب كلمة السر."; er.hidden = false; return; }
    unlock(pw).then(function (t) {
      if (!t) { er.textContent = "كلمة السر غلط."; er.hidden = false; return; }
      S.tok = t;
      return load().then(function () { $("lock").hidden = true; $("app").hidden = false; $("pw").value = ""; renderList(); }, function (x) { er.textContent = "مش قادر أوصل لجيت هب (" + x.message + ")."; er.hidden = false; });
    });
  }
  $("unlock").onclick = go;
  $("pw").addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
})();
