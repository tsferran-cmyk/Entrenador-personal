(async()=>{
 const checks=[];const check=(name,ok)=>{if(!ok)throw new Error(name);checks.push(name);};
 check('Demo opens original selection without Google',!appScreen.classList.contains('hidden')&&!quizPanel.classList.contains('hidden'));
 const savedStorage=JSON.stringify({...localStorage});
 const form=document.getElementById('trainer-form');
 for(const mode of ['propio','auto-generat','pim-pam']){
  document.querySelector(`input[name="mode"][value="${mode}"]`).checked=true;toggleModeFields();
  form.querySelector('button[type="submit"]').click();
  for(let i=0;i<50&&workoutScreen.classList.contains('hidden');i++)await new Promise(r=>setTimeout(r,10));
  check(mode+' generates exercises without OAuth',!workoutScreen.classList.contains('hidden')&&workoutExercises.length>0);
  check(mode+' displays exercise',!!document.getElementById('exercise-name-ca').textContent);
  await appendWorkoutLogRow(workoutExercises[0],1,true,{reps:'10'});
  finishWorkout(false);
 }
 check('Demo logs stay in memory',demoLog.length===3);
 // Daily proposal rotation is intentionally stored by the normal sampler.
 const storageAfter={...localStorage};const storageBefore=JSON.parse(savedStorage);
 for(const key of ['fitflow-proposal-state']){delete storageAfter[key];delete storageBefore[key];}
 check('Google account and directory preferences are preserved',JSON.stringify(storageAfter)===JSON.stringify(storageBefore));
 document.body.textContent='PASS '+checks.length+' UI checks\n'+checks.join('\n');
})().catch(error=>{document.body.textContent='FAIL '+error.stack;});
