
/* Material Icons SVG shim — converts <span class="mi">name</span> to inline SVG */
(function(){
  function renderMi(el){
    var name=(el.textContent||el.innerText||"").trim();
    if(!name||el.dataset.mir)return;
    var sym=document.getElementById("mi-"+name);
    if(!sym)return;
    el.dataset.mir="1";
    el.textContent="";
    var svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("viewBox","0 0 24 24");
    svg.setAttribute("aria-hidden","true");
    var use=document.createElementNS("http://www.w3.org/2000/svg","use");
    use.setAttribute("href","#mi-"+name);
    svg.appendChild(use);
    el.appendChild(svg);
  }
  function renderAll(root){
    (root||document).querySelectorAll(".mi:not([data-mir])").forEach(renderMi);
  }
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",function(){renderAll();});
  }else{
    renderAll();
  }
  new MutationObserver(function(muts){
    muts.forEach(function(m){
      m.addedNodes.forEach(function(n){
        if(n.nodeType!==1)return;
        if(n.classList&&n.classList.contains("mi"))renderMi(n);
        else if(n.querySelectorAll)n.querySelectorAll(".mi:not([data-mir])").forEach(renderMi);
      });
    });
  }).observe(document.body,{childList:true,subtree:true});
})();
