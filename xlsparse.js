(function (root) {
  function c(v) { return v == null ? "" : String(v).trim(); }
  function find(rows, re) { for (var i = 0; i < rows.length; i++) for (var j = 0; j < rows[i].length; j++) if (re.test(c(rows[i][j]))) return i; return -1; }
  // wb: SheetJS workbook. Returns {payers, docs}. Throws Error with Arabic message.
  function parse(XLSX, wb) {
    var sheets = wb.SheetNames.map(function (n) { return XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" }); });
    var ps = null, ds = null, ph = -1, dh = -1;
    sheets.forEach(function (rows) {
      var a = find(rows, /^payer\s*name$/i), b = find(rows, /^english\s*version$/i);
      if (a > -1 && !ps) { ps = rows; ph = a; }
      if (b > -1 && !ds) { ds = rows; dh = b; }
    });
    if (!ps) throw new Error("مش لاقي شيت الشركات (عمود Payer Name).");
    if (!ds) throw new Error("مش لاقي شيت الأوراق المطلوبة (عمود English Version).");
    var H = ps[ph].map(function (x) { return c(x).toLowerCase(); });
    var iT = H.indexOf("type"), iC = H.indexOf("code"), iN = H.indexOf("payer name"), iCe = H.indexOf("corporate"), iIe = H.indexOf("individual");
    if (iT < 0) iT = 0; if (iC < 0) iC = 1; if (iN < 0) iN = 2; if (iCe < 0) iCe = 3; if (iIe < 0) iIe = 4;
    var iCa = iIe + 1, iIa = iIe + 2;
    var P = {}, order = [];
    ps.slice(ph + 1).forEach(function (r) {
      var n = c(r[iN]); if (!n) return;
      var t = c(r[iT]);
      var k = /^ri/i.test(t) ? "ri" : "sub";
      if (!P[n]) { P[n] = { name: n, code: "", ri: null, sub: null }; order.push(n); }
      if (c(r[iC])) P[n].code = c(r[iC]);
      P[n][k] = { ce: c(r[iCe]), ie: c(r[iIe]), ca: c(r[iCa]), ia: c(r[iIa]) };
    });
    var D = [];
    ds.slice(dh + 1).forEach(function (r) {
      if (!c(r[0])) return;
      D.push({ type: c(r[0]).replace(/\n/g, " "), code: c(r[1]), en: c(r[2]), ar: c(r[3]), note: c(r[4]) });
    });
    if (!order.length) throw new Error("الشيت مفيهوش شركات.");
    return { payers: order.map(function (n) { return P[n]; }), docs: D };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { parse: parse }; else root.XLSParse = { parse: parse };
})(typeof window !== "undefined" ? window : this);
