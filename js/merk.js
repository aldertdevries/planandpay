// Kleurt overal in de zichtbare tekst de merknaam "PlanAndPay":
// Plan (blauw), And (zwart/midnight), Pay (groen). Slaat het logo,
// invoervelden en script/style over. Draait eenmalig bij het laden.
(() => {
  const KLEUR = '<span class="merk-plan">Plan</span>'
    + '<span class="merk-and">And</span>'
    + '<span class="merk-pay">Pay</span>';
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'TITLE']);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.includes('PlanAndPay')) return NodeFilter.FILTER_REJECT;
      for (let el = node.parentElement; el; el = el.parentElement) {
        if (SKIP.has(el.tagName) || el.classList.contains('logo')) return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const span = document.createElement('span');
    span.innerHTML = node.nodeValue.split('PlanAndPay').join(KLEUR);
    node.replaceWith(span);
  });
})();
