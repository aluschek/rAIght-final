// rAIght – app shell: fills the sidebar and the source strip on every page, plus a small
// DOM helper. Pages declare <body data-page="dashboard"> and contain #sidebar and #source.
// Load order on a page: data.js → shell.js → the page's own script.

(function () {
  const { data, fmt, labels } = window.rAIght;

  /** h("div", { class: "card", onclick: fn }, child, "text", …) – builds DOM, text is never parsed as HTML. */
  function h(tag, attrs, ...children) {
    const ns = ["svg", "polyline", "path", "rect", "circle", "line", "text", "g"].includes(tag) ? "http://www.w3.org/2000/svg" : null;
    const node = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value == null || value === false) continue;
      if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
      else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
      else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  // Icons: our own, drawn for rAIght in the style of SAP's Horizon icons (16-px grid, filled, drawn in currentColor). Path data only, so no font or image file is needed.
  const SAP_ICONS = {
    dashboard: "M2.25 11a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-2.5a.75.75 0 0 1 .75-.75h.5Zm4-6a.75.75 0 0 1 .75.75v8.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-8.5A.75.75 0 0 1 5.75 5h.5Zm8-4a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 .75-.75h.5Zm-4 6a.75.75 0 0 1 .75.75v6.451a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75V7.75A.75.75 0 0 1 9.75 7h.5Z",
    plan: "M12.5 9a.75.75 0 0 1 .75.75v2l2.077.004a.75.75 0 0 1 0 1.492l-2.077.004v2a.75.75 0 0 1-1.5 0v-2h-2a.75.75 0 0 1 0-1.5h2v-2A.75.75 0 0 1 12.5 9ZM.2.24A.75.75 0 0 1 1.26.2l3.5 3.249a.757.757 0 0 1 0 1.098L1.26 7.8A.751.751 0 0 1 .24 6.7l2.908-2.703L.24 1.3A.75.75 0 0 1 .2.24Zm4 0A.75.75 0 0 1 5.26.2l3.5 3.249a.757.757 0 0 1 0 1.098L5.26 7.8a.751.751 0 0 1-1.02-1.1l2.908-2.703L4.24 1.3A.75.75 0 0 1 4.2.24Zm4 0A.75.75 0 0 1 9.26.2l3.5 3.249a.757.757 0 0 1 .001 1.098L9.261 7.8a.751.751 0 0 1-1.022-1.1l2.909-2.703L8.24 1.3A.75.75 0 0 1 8.2.24Z",
    inventory: "M2 13a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm12.25 0a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5h8.5ZM2 9a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm12.25 0a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5h8.5ZM2 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm12.25 0a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5h8.5ZM2 1a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm12.25 0a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5h8.5Z",
    escalations: "M8 1c2.21 0 3.628.956 4.451 2.315.789 1.302.99 2.902.99 4.19v.636c0 1.072.341 1.976.691 2.62.189.347.41.678.669.974.442.469.098 1.265-.546 1.265h-3.837c-.281 1.15-1.256 2-2.418 2-1.162 0-2.137-.85-2.418-2H1.745c-.646 0-.989-.798-.544-1.267a5.19 5.19 0 0 0 .666-.971c.35-.645.691-1.55.691-2.621v-.636c0-1.288.202-2.888.99-4.19C4.372 1.955 5.791 1 8 1Zm0 1.5c-1.695 0-2.621.69-3.167 1.592-.582.96-.774 2.237-.774 3.413v.636c0 1.404-.45 2.563-.885 3.359h9.652c-.436-.795-.886-1.955-.886-3.36v-.635c0-1.176-.191-2.453-.773-3.413C10.621 3.19 9.695 2.5 8 2.5Z",
    learn: "M13.5 12a2.5 2.5 0 0 1 2.5 2.5.5.5 0 0 1-.5.5h-4a.515.515 0 0 1-.5-.5 2.5 2.5 0 0 1 2.5-2.5ZM11.625 2c1.387 0 2.739.471 4.045 1.354.206.14.33.374.33.623v1.218a.75.75 0 0 1-1.5 0V4.39c-.992-.605-1.947-.889-2.875-.889-.928 0-1.883.284-2.875.889v8.861c0 .59-.682.951-1.17.621-1.11-.751-2.175-1.098-3.205-1.098-1.03 0-2.095.347-3.205 1.098-.488.33-1.17-.032-1.17-.621V3.977c0-.25.125-.484.332-.623 1.306-.879 2.657-1.346 4.043-1.346 1.238 0 2.448.373 3.623 1.079C9.174 2.377 10.386 2 11.625 2Zm-7.25 1.508c-.928 0-1.883.28-2.875.88v7.567c.939-.447 1.898-.682 2.875-.682.977 0 1.936.235 2.875.682V4.39c-.992-.6-1.947-.881-2.875-.881ZM13.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z",
    about: "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm0 7a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1Zm0-4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
    company: "M2.25 11a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-2.5a.75.75 0 0 1 .75-.75h.5Zm4-6a.75.75 0 0 1 .75.75v8.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-8.5A.75.75 0 0 1 5.75 5h.5Zm8-4a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 .75-.75h.5Zm-4 6a.75.75 0 0 1 .75.75v6.451a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75V7.75A.75.75 0 0 1 9.75 7h.5Z",
    providers: "M4.302 6.107c1.538-1.533 3.943-1.432 5.476.11a.75.75 0 0 1-1.057 1.064c-.913-.93-2.395-1.076-3.362-.11l-.002.003L3.163 9.34a2.273 2.273 0 0 0 .003 3.212l.282.282a2.28 2.28 0 0 0 3.22 0 .75.75 0 0 1 1.06 1.062 3.78 3.78 0 0 1-5.34 0l-.282-.283a3.773 3.773 0 0 1 0-5.337l.002-.003 2.194-2.166Zm3.97-4.002a3.779 3.779 0 0 1 5.34 0l.283.282a3.774 3.774 0 0 1 0 5.337l-.008.007-1.865 1.807-.01.01c-2.087 1.949-4.55 1.617-5.69.815a.75.75 0 0 1 .864-1.226c.58.407 2.252.763 3.802-.685l1.848-1.792a2.273 2.273 0 0 0-.002-3.212l-.282-.283a2.28 2.28 0 0 0-3.219-.002l.001.001-.05.05a.75.75 0 0 1-1.06.002c-.329-.327-.278-.785.049-1.111Z",
    access: "M9 1a4 4 0 0 1 2.616 7.023C13.61 8.931 15 10.927 15 13.25v1a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1-.75-.75v-1c0-.084.003-.167.007-.25H1.75a.75.75 0 0 1-.75-.75v-1.5c0-1.485.78-2.824 1.964-3.587A2.965 2.965 0 0 1 2 4.975a2.975 2.975 0 0 1 4.117-2.747A3.988 3.988 0 0 1 9 1Zm0 8c-2.5 0-4.5 1.911-4.5 4.25v.25h9v-.25C13.5 10.606 11.5 9 9 9ZM5.212 8C3.725 8 2.5 9.253 2.5 10.75v.75h.774A5.844 5.844 0 0 1 6.394 8H5.213ZM9 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm-4.025 1a1.475 1.475 0 0 0 0 2.95c.098 0 .192-.013.285-.031a3.99 3.99 0 0 1 .02-2.887 1.48 1.48 0 0 0-.305-.032Z",
    tokens: "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm0 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 10A.75.75 0 1 1 8 13a.75.75 0 0 1 0-1.5Zm-3-1.25a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Zm6 0a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Zm-.28-6.03a.75.75 0 1 1 1.06 1.06L9.447 7.612a1.5 1.5 0 1 1-1.06-1.06L10.72 4.22ZM3.75 7.25a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Zm8.5 0a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5Zm-7.5-3a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5ZM8 3a.75.75 0 1 1 0 1.5A.75.75 0 0 1 8 3Z",
    runs: "m4.194 1.146 8.5 6.253a.759.759 0 0 1 0 1.21l-8.5 6.253C3.71 15.219 3 14.86 3 14.257V1.75c0-.602.709-.962 1.194-.604ZM4.5 12.773l6.483-4.77L4.5 3.234v9.54Z",
    unused: "M8.766.596a.751.751 0 0 1 .889-.58C13.298.783 16 4.168 16 8.001c0 3.835-2.694 7.223-6.346 7.984a.75.75 0 0 1-.307-1.469c2.93-.61 5.153-3.362 5.153-6.515 0-3.147-2.229-5.9-5.154-6.516a.75.75 0 0 1-.58-.889ZM3.402 13.8a.75.75 0 0 1 1.05-.147c.54.408 1.24.69 1.963.833a.75.75 0 0 1-.29 1.472c-.895-.177-1.817-.536-2.576-1.108a.75.75 0 0 1-.147-1.05ZM.537 8.782a.75.75 0 0 1 .932.506c.221.745.528 1.425.91 2.122a.751.751 0 0 1-1.316.721A12.16 12.16 0 0 1 .032 9.713a.75.75 0 0 1 .505-.931ZM7.75 3a.75.75 0 0 1 .75.75v3.866l2.703 2.039a.75.75 0 0 1-.905 1.197l-3-2.264A.75.75 0 0 1 7 7.991V3.75A.75.75 0 0 1 7.75 3Zm-6.687.64a.75.75 0 0 1 1.315.72 10.67 10.67 0 0 0-.909 2.123.75.75 0 0 1-1.437-.427c.259-.874.613-1.654 1.03-2.417ZM6.125.014a.75.75 0 1 1 .29 1.47c-.718.143-1.421.434-1.97.839a.75.75 0 1 1-.89-1.207C4.307.562 5.224.193 6.125.015Z",
    owners: "M9 1a4 4 0 0 1 2.616 7.023C13.61 8.931 15 10.927 15 13.25v1a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1-.75-.75v-1c0-.084.003-.167.007-.25H1.75a.75.75 0 0 1-.75-.75v-1.5c0-1.485.78-2.824 1.964-3.587A2.965 2.965 0 0 1 2 4.975a2.975 2.975 0 0 1 4.117-2.747A3.988 3.988 0 0 1 9 1Zm0 8c-2.5 0-4.5 1.911-4.5 4.25v.25h9v-.25C13.5 10.606 11.5 9 9 9ZM5.212 8C3.725 8 2.5 9.253 2.5 10.75v.75h.774A5.844 5.844 0 0 1 6.394 8H5.213ZM9 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm-4.025 1a1.475 1.475 0 0 0 0 2.95c.098 0 .192-.013.285-.031a3.99 3.99 0 0 1 .02-2.887 1.48 1.48 0 0 0-.305-.032Z",
    plug: "M.22.22a.75.75 0 0 1 1.06 0l2.554 2.553a2.75 2.75 0 0 1 3.875.026l5.486 5.524a2.75 2.75 0 0 1 .031 3.843l2.554 2.554a.75.75 0 1 1-1.06 1.06l-2.544-2.544a2.747 2.747 0 0 1-3.859-.034L2.82 7.682a2.75 2.75 0 0 1-.039-3.84L.22 1.28a.75.75 0 0 1 0-1.06Zm6.932 9.687 2.229 2.238a1.25 1.25 0 0 0 1.78-.01l.978-1a1.25 1.25 0 0 0-.007-1.754L9.913 7.146l-2.76 2.761Zm-.508-6.05a1.25 1.25 0 0 0-1.778.002l-.988 1.005a1.25 1.25 0 0 0 .005 1.76l2.212 2.22 2.76-2.761-2.21-2.227Z",
    chat: "M10.083 0A1.92 1.92 0 0 1 12 1.918V3h2.083C15.139 3 16 3.862 16 4.918v9.337c0 .667-.845 1-1.299.511l-2.112-2.27H5.917A1.92 1.92 0 0 1 4 10.58V9.495h-.589L1.3 11.765c-.454.49-1.299.157-1.299-.51V1.918A1.919 1.919 0 0 1 1.917 0h8.166ZM12 7.578a1.92 1.92 0 0 1-1.917 1.917H5.5v1.085c0 .227.19.416.417.416h7a.75.75 0 0 1 .549.24l1.034 1.111V4.92a.42.42 0 0 0-.417-.417H12v3.076ZM1.917 1.501a.42.42 0 0 0-.417.417v7.428l1.034-1.112a.75.75 0 0 1 .549-.24h7a.42.42 0 0 0 .417-.416v-5.66a.42.42 0 0 0-.417-.417H1.917Z",
    chevron: "M12.83 6.273a.75.75 0 0 1-.104 1.056l-4.247 3.5a.75.75 0 0 1-.954 0l-4.252-3.5a.75.75 0 0 1 .954-1.158l3.775 3.107 3.771-3.107a.75.75 0 0 1 1.056.102Z",
    search: "M7 1a6 6 0 0 1 4.738 9.678l3.042 3.042a.75.75 0 1 1-1.06 1.06l-3.042-3.042A6 6 0 1 1 7 1Zm0 1.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z",
    scope: "M7.5 1c.625 0 1.273.066 1.898.225a.75.75 0 0 1-.37 1.454A6.238 6.238 0 0 0 7.5 2.5c-3.293 0-6 2.707-6 6s2.707 6 6 6 6-2.707 6-6c0-.54-.047-1.036-.176-1.518a.75.75 0 0 1 1.45-.389A7.28 7.28 0 0 1 15 8.5c0 4.122-3.378 7.5-7.5 7.5S0 12.622 0 8.5C0 4.38 3.378 1 7.5 1Zm-.354 3.002a.75.75 0 0 1 .101 1.496C5.71 5.603 4.5 6.915 4.5 8.5c0 1.564 1.369 3 3 3 1.561 0 2.88-1.205 3.002-2.754a.75.75 0 0 1 1.496.117C11.815 11.206 9.831 13 7.5 13 5.017 13 3 10.87 3 8.5c0-2.346 1.792-4.338 4.146-4.498ZM12.68.262A.75.75 0 0 1 14 .75V2h1.25a.75.75 0 0 1 .487 1.32l-1.75 1.5A.751.751 0 0 1 13.5 5h-1.44L8.948 8.113a1.5 1.5 0 1 1-1.06-1.06L11 3.938V2.5c0-.179.064-.352.18-.488l1.5-1.75Z",
    goal: "M2.75 0a.75.75 0 0 1 .75.75v.564a4.565 4.565 0 0 1 4.191.454c.156.103.328.189.49.284 1.578 1.009 3.183.85 4.768.037a.672.672 0 0 1 .692.026.75.75 0 0 1 .359.64v7.47a.75.75 0 0 1-.37.646v.001c-1.998 1.192-4.256 1.65-6.275.276l-.45-.3c-.993-.67-2.287-.565-3.405.168v4.234a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 2.75 0Z",
    history: "M7.92 0C12.394 0 16 3.55 16 8s-3.606 8-8.08 8C4.066 16 .832 13.341.02 9.778a.751.751 0 0 1 1.463-.334C2.139 12.325 4.766 14.5 7.92 14.5c3.662 0 6.58-2.895 6.58-6.5s-2.918-6.5-6.58-6.5C5.38 1.5 3.143 2.927 2.06 5h3.19a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 5.75v-5a.75.75 0 0 1 1.5 0v2.362A8.155 8.155 0 0 1 7.92 0Zm-.17 3a.75.75 0 0 1 .75.75v3.866l2.703 2.04a.75.75 0 0 1-.905 1.196l-3-2.263A.751.751 0 0 1 7 7.99V3.75A.75.75 0 0 1 7.75 3Z",
    settings: "M8.549 0a1.757 1.757 0 0 1 1.568 1.49l.121.805a.251.251 0 0 0 .123.18l1.238.715a.252.252 0 0 0 .217.017l.755-.298a1.75 1.75 0 0 1 2.156.754v.001l.387.673a1.75 1.75 0 0 1-.423 2.244l-.617.49a.251.251 0 0 0-.094.196v1.465c0 .076.035.148.094.196l.616.49c.677.54.858 1.495.425 2.245l-.387.673h-.001a1.75 1.75 0 0 1-2.155.755l-.757-.298a.251.251 0 0 0-.217.016l-1.238.715a.251.251 0 0 0-.122.18l-.12.806A1.75 1.75 0 0 1 8.387 16H7.61a1.75 1.75 0 0 1-1.698-1.333l-.16-1.013a.25.25 0 0 0-.122-.18l-1.184-.684a.251.251 0 0 0-.216-.016l-.803.317a1.75 1.75 0 0 1-2.156-.754l-.387-.675-.001.001a1.753 1.753 0 0 1 .425-2.244l.695-.555A.25.25 0 0 0 2.1 8.67V7.33a.25.25 0 0 0-.095-.195L1.31 6.58a1.753 1.753 0 0 1-.425-2.244l.388-.674a1.75 1.75 0 0 1 2.156-.754l.802.317c.07.027.15.02.216-.017l1.185-.685a.25.25 0 0 0 .122-.18l.16-1.011A1.75 1.75 0 0 1 7.611 0h.938Zm-.982 1.504a.25.25 0 0 0-.19.164l-.14.9a1.75 1.75 0 0 1-.855 1.255l-1.185.685a1.752 1.752 0 0 1-1.516.113l-.803-.315a.25.25 0 0 0-.307.107l-.388.673a.253.253 0 0 0 .06.321l.696.555c.416.332.66.835.66 1.368v1.34a1.75 1.75 0 0 1-.66 1.368l-.695.555a.251.251 0 0 0-.061.321l.387.674a.25.25 0 0 0 .308.107l.802-.315a1.752 1.752 0 0 1 1.517.112l1.185.685c.461.266.775.729.854 1.256l.14.9a.25.25 0 0 0 .235.168h.777a.25.25 0 0 0 .246-.213l.121-.806a1.75 1.75 0 0 1 .855-1.255l1.238-.716a1.751 1.751 0 0 1 1.516-.114l.757.298c.1.04.213.01.28-.07l.415-.71a.25.25 0 0 0-.06-.321l-.617-.492a1.751 1.751 0 0 1-.66-1.369V7.267c0-.533.244-1.037.66-1.369l.616-.49a.25.25 0 0 0 .06-.321l-.387-.675a.249.249 0 0 0-.307-.106l-.758.297a1.75 1.75 0 0 1-1.515-.114L9.61 3.773a1.75 1.75 0 0 1-.855-1.255l-.121-.805a.25.25 0 0 0-.201-.21h-.866ZM8 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z",
    check: "M12.688 3.254a.75.75 0 0 1 1.124.992l-7.5 8.5A.75.75 0 0 1 5.15 12.7l-3-4a.75.75 0 0 1 1.2-.9l2.447 3.263 6.89-7.81Z",
    close: "M11.72 3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L8 9.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06L6.94 8 3.22 4.28a.75.75 0 1 1 1.06-1.06L8 6.94l3.72-3.72Z",
    uniform: "M12.25 3A2.75 2.75 0 0 1 15 5.75v7.5A2.75 2.75 0 0 1 12.25 16h-5.5A2.75 2.75 0 0 1 4 13.25v-7.5A2.75 2.75 0 0 1 6.75 3h5.5Zm-5.5 1.5c-.69 0-1.25.56-1.25 1.25v7.5c0 .69.56 1.25 1.25 1.25h5.5c.69 0 1.25-.56 1.25-1.25v-7.5c0-.69-.56-1.25-1.25-1.25h-5.5Zm4.5-4.5a.75.75 0 0 1 0 1.5h-7.5c-.69 0-1.25.56-1.25 1.25v8.5a.75.75 0 0 1-1.5 0v-8.5A2.75 2.75 0 0 1 3.75 0h7.5Z"
  };
  /** sapIcon("bell", 18) – an inline SVG; the size is in px (default 18). */
  function sapIcon(name, size = 18) {
    return h("svg", { class: "sap-icon", width: size, height: size, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", focusable: "false" },
      h("path", { d: SAP_ICONS[name] || "" }));
  }
  const icon = (name) => sapIcon(name, 18);

  // Menu: Dashboard (the landing page), then the daily work (Build, Monitor); Guidelines sits at the bottom.
  // Each role has its own home page and menu (the data is the same finished sample data for all of them):
  //   Process owner: dashboard, plan, automations, escalations. CIO office: company dashboard (aggregated, read-only).
  //   Admin: providers, access (no usage data at all).
  const HOME = { process_owner: "dashboard", cio_office: "company", admin: "providers" };
  const NAV = [
    { group: "Overview", items: [["dashboard", "Dashboard", (m) => m.role === "process_owner"], ["company", "Dashboard", (m) => m.role === "cio_office"]] },
    { group: "Build", items: [["plan", "Plan an automation", (m) => m.can("plan")]] },
    { group: "Monitor", items: [["inventory", "Automations", (m) => m.role === "process_owner"], ["escalations", "Escalations", (m) => m.role === "process_owner"]] },
    { group: "Admin", items: [["providers", "Providers", (m) => m.can("providers")], ["access", "Access", (m) => m.can("access")]] },
  ];
  let me = null; // the person the demo is shown as (data.getMe())
  let version = ""; // shown next to the logo; the single source is data/content/about.json
  // Training material, not part of the daily work: pinned to the bottom, apart from the working menu.
  const REFERENCE = ["learn", "Guidelines"];

  /** A button that asks once before it acts: the first click turns it into "Confirm", the second one runs `action`. */
  function confirmButton({ label, confirmLabel = "Confirm remove", className = "btn btn-sm btn-danger", ariaLabel, action }) {
    let timer;
    const btn = h("button", { class: className, type: "button", "aria-label": ariaLabel || label, onclick: () => {
      if (btn.dataset.armed) { clearTimeout(timer); action(); return; }
      btn.dataset.armed = "1"; btn.textContent = confirmLabel;
      timer = setTimeout(() => { delete btn.dataset.armed; btn.textContent = label; }, 4000);
    } }, label);
    return btn;
  }

  /** The mark: three rising steps, the lowest one the brightest ("use the lowest step that does the job"). */
  function logoMark() {
    const step = (x, y, opacity) => h("rect", { x, y, width: 6.7, height: 26 - y, rx: 1, fill: "#fff", "fill-opacity": opacity });
    return h("svg", { width: "100%", height: "100%", viewBox: "0 0 34 34", "aria-hidden": "true" }, step(7, 18, 1), step(13.7, 13, 0.55), step(20.4, 8, 0.55));
  }

  function pageUrl(id) { return new URL(`pages/${id}/`, data.root).href; }

  function renderSidebar(current, summary, openCases) {
    const el = document.getElementById("sidebar");
    if (!el) return;
    el.classList.add("sidebar");
    el.setAttribute("aria-label", "Main");
    el.replaceChildren(
      h("div", { class: "sidebar-menu", id: "sidebar-menu" },
        ...NAV.map(({ group, items }) => ({ group, items: items.filter(([, , show]) => !show || !me || show(me)) }))
          .filter(({ items }) => items.length > 0)
          .map(({ group, items }) => h("div", { class: "nav-group" },
          group && h("span", { class: "nav-label" }, group),
          items.map(([id, label]) => h("a", { class: "nav-link", href: pageUrl(id), "aria-current": id === current ? "page" : null },
            icon(id), h("span", { class: "nav-text" }, label),
            id === "escalations" && openCases > 0 && h("span", { class: "badge-count num" }, openCases))))),
        h("div", { class: "sidebar-spacer" }),
        h("div", { class: "sidebar-bottom" },
          h("a", { class: "nav-link", href: pageUrl(REFERENCE[0]), "aria-current": current === REFERENCE[0] ? "page" : null },
            icon(REFERENCE[0]), h("span", { class: "nav-text" }, REFERENCE[1])),
          h("a", { class: "nav-link", href: pageUrl("about"), "aria-current": current === "about" ? "page" : null },
            icon("about"), h("span", { class: "nav-text" }, "About")))),
    );
  }

  /** Fiori-style shell bar across the top: logo, demo version, menu button (small screens), person menu. */
  function renderShellbar() {
    if (document.querySelector(".shellbar")) return;
    const sidebar = document.getElementById("sidebar");
    const bar = h("header", { class: "shellbar", role: "banner" },
      h("button", {
        class: "menu-toggle", type: "button", "aria-label": "Menu", "aria-expanded": "false", "aria-controls": "sidebar-menu",
        onclick: (e) => { const open = sidebar.classList.toggle("is-open"); e.currentTarget.setAttribute("aria-expanded", String(open)); },
      }, h("svg", { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "aria-hidden": "true" }, h("path", { d: "M4 7h16M4 12h16M4 17h16" }))),
      h("a", { class: "sidebar-brand", href: pageUrl(me ? HOME[me.role] : "dashboard") },
        h("span", { class: "logo-mark", "aria-hidden": "true" }, logoMark()),
        h("span", { class: "logo" }, "r", h("span", { class: "logo-ai" }, "AI"), "ght"),
        version && h("span", { class: "pill-demo", title: `Version ${version}` }, version)),
      h("div", { class: "shellbar-spacer" }));
    document.body.prepend(bar);
  }

  /** Fiori breadcrumb above the page title: Home › (Automations ›) this page. Not shown on a role's home page. */
  function renderBreadcrumb(current) {
    const title = document.querySelector(".topbar-title");
    if (!title || title.querySelector(".breadcrumb") || !me || current === HOME[me.role]) return;
    const heading = title.querySelector(".page-title");
    const trail = [h("a", { href: pageUrl(HOME[me.role]) }, "Home")];
    if (current === "agent") trail.push(h("span", { class: "sep", "aria-hidden": "true" }, "›"), h("a", { href: pageUrl("inventory") }, "Automations"));
    trail.push(h("span", { class: "sep", "aria-hidden": "true" }, "›"), h("span", { "aria-current": "page" }, heading ? heading.textContent : current));
    title.prepend(h("nav", { class: "breadcrumb", "aria-label": "Breadcrumb" }, trail));
  }

  /** "Welcome back, <name>" on pages that have a #greeting heading (the two dashboards). */
  function renderGreeting() {
    const el = document.getElementById("greeting");
    if (!el || !me) return;
    // A person's name gets the accent colour; a role account (CIO office, Admin) is not a name, so it just says "Welcome back".
    if (me.role === "process_owner") el.replaceChildren("Welcome back, ", h("span", { class: "greeting-name" }, me.name));
    else el.textContent = "Welcome back";
  }

  // Not called for now: the source strip ("Run logs imported …") is hidden on every page. Call it from init() to bring it back.
  /** Who the demo is shown as sits at the far right of the top bar on every page; opening it switches the person. */
  async function renderUser() {
    const bar = document.querySelector(".shellbar");
    if (!bar || bar.querySelector(".user-menu")) return;
    const users = await data.getUsers();
    const roleLine = (u) => `${labels.role[u.role]}${u.role === "cio_office" ? " · read-only" : ""}`;
    const avatar = (u) => h("span", { class: "avatar", "aria-hidden": "true" }, u.name[0]);
    const toggle = h("button", { class: "topbar-user", type: "button", "aria-haspopup": "true", "aria-expanded": "false", onclick: () => setOpen(pop.hidden) },
      avatar(me),
      h("span", { class: "user-text" }, h("span", { style: { fontWeight: 600 } }, me.name), h("span", { class: "user-role" }, roleLine(me))),
      (() => { const c = sapIcon("chevron", 14); c.classList.add("user-chev"); return c; })());
    const pop = h("div", { class: "user-pop", hidden: true, role: "menu", "aria-label": "View the demo as" },
      h("p", { class: "user-pop-title" }, "View the demo as"),
      users.map((u) => h("button", {
        class: `user-opt${u.you ? " is-current" : ""}`, type: "button", role: "menuitemradio", "aria-checked": String(u.you),
        onclick: () => { if (!u.you) { data.setMe(u.email); location.reload(); } else setOpen(false); },
      }, avatar(u), h("span", { class: "user-text" }, h("span", { style: { fontWeight: 600 } }, u.name), h("span", { class: "user-role" }, roleLine(u))), u.you && h("span", { class: "user-check", "aria-hidden": "true" }, "✓"))));
    function setOpen(open) { pop.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); }
    document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
    const wrap = h("div", { class: "user-menu" }, toggle, pop);
    bar.append(wrap);
  }

  function renderSource(summary) {
    const el = document.getElementById("source");
    if (!el) return;
    el.classList.add("source-strip");
    el.replaceChildren(
      h("span", { class: "source-item" }, h("span", { class: "dot", "aria-hidden": "true" }),
        summary ? `Run logs imported ${fmt.dateTime(summary.last_import)} from ${summary.providers.map((p) => p.name).join(", ")}` : "Sample data"),
      h("span", { class: "demo-label" }, "Demo data · illustrative values"));
  }

  function showError(err) {
    const target = document.querySelector(".content") || document.body;
    target.prepend(h("p", { class: "load-error", role: "alert" },
      "Could not load the demo data. Open the app through a web server (such as python3 -m http.server in app/), not as a file. ",
      h("code", null, String(err.message || err))));
  }

  async function init() {
    const current = document.body.dataset.page;
    document.body.classList.add("is-loading");
    Promise.allSettled([data.getSummary(), data.getAgents()]).then(() => requestAnimationFrame(() => document.body.classList.remove("is-loading")));
    try {
      me = await data.getMe();
      try { version = (await data.getContent("about")).version || ""; } catch { /* the pill then just says Demo */ }
      // A page can name the roles it is for (data-roles on <body>); anyone else goes to their own home page.
      const allowed = (document.body.dataset.roles || "").split(" ").filter(Boolean);
      if (allowed.length && !allowed.includes(me.role)) { location.replace(pageUrl(HOME[me.role])); return; }
      renderShellbar();
      renderBreadcrumb(current);
      renderGreeting();
      await renderUser();
      renderSidebar(current, null, 0);
      const summary = await data.getSummary();
      renderSidebar(current, summary, await openCases());
    } catch (err) { showError(err); }
  }

  async function openCases() {
    try { return (await data.getEscalations()).filter((e) => !e.handled).length; } catch { return 0; }
  }

  /** Pages call this after a change that affects the sidebar (e.g. an escalation was handled). */
  async function refreshSidebar() {
    renderSidebar(document.body.dataset.page, await data.getSummary(), await openCases());
  }

  window.rAIght.h = h;
  window.rAIght.sapIcon = sapIcon;
  window.rAIght.showError = showError;
  window.rAIght.pageUrl = pageUrl;
  window.rAIght.logoMark = logoMark;
  window.rAIght.confirmButton = confirmButton;
  window.rAIght.refreshSidebar = refreshSidebar;
  init();
})();
