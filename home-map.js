(function(global){
  let activeMap=null;
  const defaults={
    system:{x:460,y:24},security:{x:22,y:132},agenda:{x:162,y:132},patients:{x:302,y:132},pos:{x:442,y:132},inventory:{x:582,y:132},authorizations:{x:722,y:132},operations:{x:862,y:132},audit:{x:1002,y:132},
    branches:{x:38,y:286},doctor:{x:45,y:470},manager:{x:220,y:470},executive:{x:395,y:470},reception:{x:570,y:470},'ops-role':{x:745,y:470},principles:{x:920,y:450}
  };

  function init({layout={},onChange}){
    const board=document.querySelector('#homeMapBoard');
    if(!board)return;
    const lines=document.querySelector('#homeMapLines');
    const positions={...defaults,...layout};
    const nodes=[...board.querySelectorAll('[data-map-node]')];
    const place=node=>{const point=positions[node.dataset.mapNode]||defaults[node.dataset.mapNode];node.style.left=`${point.x}px`;node.style.top=`${point.y}px`};
    const drawLines=()=>{
      const pairs=['security','agenda','patients','pos','inventory','authorizations','operations','audit'].map(id=>['system',id]).concat([
        ['security','branches'],['agenda','branches'],['patients','branches'],['pos','branches'],['inventory','branches'],['authorizations','branches'],['operations','branches'],['audit','branches'],
        ['branches','doctor'],['branches','manager'],['branches','executive'],['branches','reception'],['branches','ops-role'],['branches','principles']
      ]);
      lines.innerHTML=pairs.map(([from,to],index)=>{const a=board.querySelector(`[data-map-node="${from}"]`),b=board.querySelector(`[data-map-node="${to}"]`);const x1=a.offsetLeft+a.offsetWidth/2,y1=a.offsetTop+a.offsetHeight/2,x2=b.offsetLeft+b.offsetWidth/2,y2=b.offsetTop+b.offsetHeight/2;return `<line class="${index<8?'primary':''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`}).join('');
    };
    const persist=()=>onChange?.(JSON.parse(JSON.stringify(positions)));
    const move=(node,x,y)=>{
      const maxX=board.clientWidth-node.offsetWidth,maxY=board.clientHeight-node.offsetHeight;
      positions[node.dataset.mapNode]={x:Math.max(0,Math.min(maxX,Math.round(x))),y:Math.max(0,Math.min(maxY,Math.round(y)))};
      place(node);drawLines();
    };
    nodes.forEach(node=>{
      place(node);
      node.addEventListener('pointerdown',event=>{
        if(event.button!==undefined&&event.button!==0)return;
        const start=positions[node.dataset.mapNode],origin={x:event.clientX,y:event.clientY};
        node.setPointerCapture(event.pointerId);node.classList.add('dragging');
        const dragging=moveEvent=>move(node,start.x+moveEvent.clientX-origin.x,start.y+moveEvent.clientY-origin.y);
        const finish=()=>{node.classList.remove('dragging');node.removeEventListener('pointermove',dragging);persist()};
        node.addEventListener('pointermove',dragging);node.addEventListener('pointerup',finish,{once:true});node.addEventListener('pointercancel',finish,{once:true});
      });
      node.addEventListener('keydown',event=>{
        const delta=event.shiftKey?1:10,point=positions[node.dataset.mapNode];
        const directions={ArrowLeft:[-delta,0],ArrowRight:[delta,0],ArrowUp:[0,-delta],ArrowDown:[0,delta]};
        if(!directions[event.key])return;event.preventDefault();const [dx,dy]=directions[event.key];move(node,point.x+dx,point.y+dy);persist();
      });
    });
    drawLines();
    document.querySelector('#resetHomeMap').onclick=()=>{Object.keys(positions).forEach(key=>delete positions[key]);Object.assign(positions,defaults);nodes.forEach(place);drawLines();persist()};
    activeMap={positions,nodes,place,drawLines};
  }

  function setLayout(layout={}){
    if(!activeMap)return;
    Object.keys(activeMap.positions).forEach(key=>delete activeMap.positions[key]);
    Object.assign(activeMap.positions,defaults,layout);
    activeMap.nodes.forEach(activeMap.place);activeMap.drawLines();
  }

  global.HomeMap=Object.freeze({init,setLayout});
})(window);
