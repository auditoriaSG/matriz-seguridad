(function(global){
  const PAGE={width:1191,height:842,margin:28};
  const COLORS={navy:[0.027,0.231,0.388],cream:[0.871,0.78,0.6],light:[0.95,0.97,0.98],line:[0.74,0.79,0.82],white:[1,1,1],text:[0.08,0.12,0.15]};
  const widths=[142,158,335,70,70,70,70,70,70,70];
  const xPositions=widths.reduce((list,width)=>[...list,list[list.length-1]+width],[PAGE.margin]);

  function cleanText(value){
    return String(value??'').replace(/[\u2010-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2190-\u21ff]/g,'>').replace(/[^\x20-\xFF]/g,'?');
  }
  function pdfString(value){return cleanText(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}
  function n(value){return Number(value.toFixed(2))}
  function wrap(value,width,fontSize=6.6){
    const text=cleanText(value).replace(/\s+/g,' ').trim();
    if(!text)return [''];
    const max=Math.max(4,Math.floor(width/(fontSize*.54))),words=text.split(' '),lines=[];
    let line='';
    words.forEach(word=>{
      while(word.length>max){if(line){lines.push(line);line=''}lines.push(word.slice(0,max));word=word.slice(max)}
      const candidate=line?`${line} ${word}`:word;
      if(candidate.length>max&&line){lines.push(line);line=word}else line=candidate;
    });
    if(line)lines.push(line);
    return lines;
  }
  function color(values,stroke=false){return `${values.map(n).join(' ')} ${stroke?'RG':'rg'}`}
  function text(command,x,y,value,{font='F1',size=6.6,align='left',width=0,colorValue=COLORS.text}={}){
    const safe=cleanText(value),estimated=safe.length*size*.48;
    let tx=x;
    if(align==='center')tx=x+Math.max(0,(width-estimated)/2);
    if(align==='right')tx=x+Math.max(0,width-estimated);
    command.push(`BT /${font} ${n(size)} Tf ${color(colorValue)} 1 0 0 1 ${n(tx)} ${n(y)} Tm (${pdfString(safe)}) Tj ET`);
  }
  function rect(command,x,top,width,height,{fill=null,stroke=COLORS.line}={}){
    const y=PAGE.height-top-height;
    if(fill)command.push(`${color(fill)} ${n(x)} ${n(y)} ${n(width)} ${n(height)} re f`);
    if(stroke)command.push(`${color(stroke,true)} 0.45 w ${n(x)} ${n(y)} ${n(width)} ${n(height)} re S`);
  }
  function cellLines(command,lines,x,top,width,height,{font='F1',size=6.6,align='left',colorValue=COLORS.text}={}){
    const lineHeight=size+1.8,total=lines.length*lineHeight,start=top+(height-total)/2+size;
    lines.forEach((line,index)=>text(command,x+4,PAGE.height-(start+index*lineHeight),line,{font,size,align,width:width-8,colorValue}));
  }
  function tableHeader(command,top,profiles){
    const labels=['Título','Subtítulo','Permiso',...profiles];
    labels.forEach((label,index)=>{
      rect(command,xPositions[index],top,widths[index],34,{fill:COLORS.navy,stroke:COLORS.white});
      cellLines(command,wrap(label,widths[index]-8,6.3),xPositions[index],top,widths[index],34,{font:'F2',size:6.3,align:'center',colorValue:COLORS.white});
    });
    return top+34;
  }
  function pageStart(command,pageNumber){
    text(command,PAGE.margin,PAGE.height-31,'NEXUS SK - Matriz general de perfiles',{font:'F2',size:14,colorValue:COLORS.navy});
    text(command,PAGE.width-PAGE.margin-220,PAGE.height-29,new Intl.DateTimeFormat('es-MX',{dateStyle:'medium'}).format(new Date()),{size:7,align:'right',width:220,colorValue:COLORS.navy});
    text(command,PAGE.margin,PAGE.height-47,'A = Aplica   N = Sin acceso   - = Pendiente',{font:'F2',size:7,colorValue:COLORS.navy});
    text(command,PAGE.width-PAGE.margin-100,18,`Página ${pageNumber}`,{size:7,align:'right',width:100,colorValue:COLORS.navy});
    return 58;
  }
  function makePages(rows,profiles){
    const pages=[];
    let command=[],top=pageStart(command,1);
    top=tableHeader(command,top,profiles);
    rows.forEach((row,rowIndex)=>{
      const cells=[wrap(row.title,widths[0]-8),wrap(row.subtitle,widths[1]-8),wrap(row.permission,widths[2]-8),...row.values.map(value=>[value])];
      const height=Math.max(18,...cells.map(lines=>lines.length*8+7));
      if(top+height>PAGE.height-31){pages.push(command);command=[];top=pageStart(command,pages.length+1);top=tableHeader(command,top,profiles)}
      cells.forEach((lines,index)=>{
        rect(command,xPositions[index],top,widths[index],height,{fill:rowIndex%2?COLORS.white:COLORS.light});
        cellLines(command,lines,xPositions[index],top,widths[index],height,{font:index>2?'F2':'F1',size:index>2?7:6.6,align:index>2?'center':'left'});
      });
      top+=height;
    });
    pages.push(command);
    const total=pages.length;
    pages.forEach((commands,index)=>text(commands,PAGE.width/2-45,18,`${index+1} de ${total}`,{size:7,align:'center',width:90,colorValue:COLORS.navy}));
    return pages;
  }
  function latin1Bytes(value){const bytes=new Uint8Array(value.length);for(let i=0;i<value.length;i++)bytes[i]=value.charCodeAt(i)&255;return bytes}
  function assemblePdf(pageCommands){
    const objects=[null,'','',`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`],pageIds=[];
    const add=value=>{objects.push(value);return objects.length-1};
    pageCommands.forEach(commands=>{
      const stream=commands.join('\n'),contentId=add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      pageIds.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`));
    });
    objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
    objects[2]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
    let pdf='%PDF-1.4\n%âãÏÓ\n',offsets=[0];
    for(let id=1;id<objects.length;id++){offsets[id]=pdf.length;pdf+=`${id} 0 obj\n${objects[id]}\nendobj\n`}
    const xref=pdf.length;
    pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for(let id=1;id<objects.length;id++)pdf+=`${String(offsets[id]).padStart(10,'0')} 00000 n \n`;
    pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return latin1Bytes(pdf);
  }
  function build(rows,profiles){return assemblePdf(makePages(rows,profiles))}
  function download(rows,profiles){
    const bytes=build(rows,profiles),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),anchor=document.createElement('a'),date=new Date().toISOString().slice(0,10);
    anchor.href=url;anchor.download=`matriz-general-perfiles-${date}.pdf`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    return {rows:rows.length,bytes:bytes.length};
  }
  global.MatrixPdf=Object.freeze({build,download});
})(typeof window!=='undefined'?window:globalThis);
