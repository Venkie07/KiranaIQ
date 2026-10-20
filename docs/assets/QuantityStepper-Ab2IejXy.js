import{c as d,u as m,j as t}from"./index-lA-Yt4Sa.js";import{P as b}from"./plus-l7MKrxau.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=d("Minus",[["path",{d:"M5 12h14",key:"1ays0h"}]]);function y({value:s,onChange:r,min:e=0,max:n=99999,step:o=1,disabled:i,label:a}){const{t:c}=m(),u=p=>Math.min(n,Math.max(e,p));return t.jsxs("div",{className:"stepper",role:"group","aria-label":a,children:[t.jsx("button",{type:"button",className:"stepper__btn",onClick:()=>r(u(s-o)),disabled:i||s<=e,"aria-label":`${a}: ${c("sales.quantityMinus")}`,children:t.jsx(h,{size:20,"aria-hidden":"true"})}),t.jsx("input",{className:"stepper__input",type:"number",inputMode:"numeric",value:String(s),min:e,max:n,disabled:i,"aria-label":a,onChange:p=>{const l=Number.parseInt(p.target.value,10);r(Number.isNaN(l)?e:u(l))}}),t.jsx("button",{type:"button",className:"stepper__btn",onClick:()=>r(u(s+o)),disabled:i||s>=n,"aria-label":`${a}: ${c("sales.quantityPlus")}`,children:t.jsx(b,{size:20,"aria-hidden":"true"})})]})}export{y as Q};
