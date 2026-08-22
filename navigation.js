(function(){
  function closeOtherMenus(current){
    document.querySelectorAll('.view-submenu').forEach(menu=>{
      if(menu!==current)menu.hidden=true;
    });
    document.querySelectorAll('[data-submenu]').forEach(button=>{
      if(button.dataset.submenu!==current.id){
        button.setAttribute('aria-expanded','false');
        button.querySelector('b').textContent='+';
      }
    });
  }

  function openDefaultOption(menu){
    const firstOption=menu.querySelector('button');
    if(firstOption)firstOption.click();
  }

  function init(actions){
    document.querySelector('#homeTab').onclick=()=>actions.openMainView('home');
    document.querySelector('#shortcutsTab').onclick=()=>actions.openMainView('permissions');
    document.querySelector('#nexusAccessTab').onclick=()=>actions.openMainView('nexus-access');

    document.querySelector('.view-switch').addEventListener('click',event=>{
      const toggle=event.target.closest('[data-submenu]');
      if(toggle){
        const menu=document.querySelector(`#${toggle.dataset.submenu}`);
        const wasOpen=!menu.hidden;
        if(!wasOpen)closeOtherMenus(menu);
        menu.hidden=wasOpen;
        toggle.setAttribute('aria-expanded',String(!wasOpen));
        toggle.querySelector('b').textContent=wasOpen?'+':'−';
        if(!wasOpen)openDefaultOption(menu);
        return;
      }

      const option=event.target.closest('[data-owner-type]');
      if(option)actions.openOwnedArea(option.dataset.ownerType,option.dataset.ownerSection||'',option);
    });
  }

  window.AppNavigation={init};
})();
