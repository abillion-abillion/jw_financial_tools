#!/usr/bin/env python3
"""Reproduce example-only calibration; Python + NumPy + SciPy (development only).
Base training: -1%, 3.75%; withheld return: 2.5%, all durations.
Savings calibration: all available displayed scenarios, NOT independent validation.
Sources: 40세 남자.pdf p13/15/18; 40세 여.pdf p13/16. No personal data.
Amounts inside optimization use millions of won, exported parameters use won.
Effective charges are not identified actuarial mortality/expense rates.
"""
import numpy as np,json,argparse
from scipy.optimize import least_squares
from pathlib import Path
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'metlife/fixtures.json').read_text())
periods=[1,6,11,16,21,26,31,36]
conv={'male':{'initial':{'-1':155.82,'2.5':176.50,'3.75':184.56},'observed':{'-1':[152.70,136.17,117.14,93.97,62.67,16.56,0,0],'2.5':[179.24,192.19,202.69,208.51,204.54,181.84,116.90,0],'3.75':[189.76,216.86,244.85,271.90,293.09,299.31,265.83,156.40]}},'female':{'initial':{'2.5':48.38,'3.75':50.59},'observed':{'2.5':[48.73,49.60,49.09,45.91,39.01,24.33,0,0],'3.75':[51.62,56.26,60.22,62.21,61.08,52.56,20.63,0]}}}
nodes=np.array([40,47,53,58,63,68,73,78,83,90.])
def savings(theta,sex,rate):
 a=conv[sex]['initial'][format(rate,'g')]
 g=(1+rate/100)**(1/12)
 months=np.arange(36*12)
 q=np.exp(np.interp(47+months/12,nodes,theta[:-1]))
 f=(1-(.0015+theta[-1])/12)*g
 factors=f**(months+1)
 vals=factors*(a-np.cumsum(q*g/12/factors))
 return np.maximum(vals[11::12],0)

fits={}
for sex in conv:
 def residual(theta):
  res=[]
  for r,obs in conv[sex]['observed'].items():
   pred=savings(theta,sex,float(r))[np.array(periods)-1]
   for p,o in zip(pred,obs):
    # zero source rows are censored: no exact equality requirement at depletion
    res.append((p-o)/max(o,10)**.2)
  # curvature smoothness penalty; early ages unsupported (fix extrapolate below 47 later)
  slopes=np.diff(theta[:-1])/np.diff(nodes)
  res.extend(np.diff(slopes)*2)
  res.append((theta[0]-(theta[1]-(theta[2]-theta[1])*7/6))*3)
  res.append((theta[-2]-(theta[-3]+(theta[-3]-theta[-4])*7/5))*3)
  return res
 out=least_squares(residual,np.r_[np.log(np.exp((nodes-47)*.09)*(1.5 if sex=='male' else .8)),.001],max_nfev=250,bounds=(np.r_[np.full(len(nodes),-6),0],np.r_[np.full(len(nodes),8),.05]))
 fits[sex]=out.x
 print('balancecost',out.x[-1])
 print(sex,'savings costs million/1b/year',list(zip(nodes,np.exp(out.x[:-1]).round(5))))
 for r,obs in conv[sex]['observed'].items():
  pred=savings(out.x,sex,float(r))[np.array(periods)-1]
  print(r,'err million',np.round(pred-obs,3))
base_nodes=np.array([40,47,50,55,60,65,70,75,80,85,90.])
for sex in conv:
 prof=data['profiles'][sex]; P=prof['monthlyBasePremiumWon']/1e6
 cases=[(r,e) for e in [0,1] if e==0 or sex=='male' for r in [-1.,2.5,3.75]]
 obs=[(row['month'],cases.index((float(r),int(plan=='extra100'))),s['surrenderDisplayWon']/1e6) for plan in ['base','extra100'] for row in prof.get(plan,[]) for r,s in row['scenarios'].items()]
 ages=40+np.arange(588)/12
 g=np.array([(1+r/100)**(1/12) for r,e in cases]);ex=np.array([e for r,e in cases])
 def predict(par):
  q=np.exp(np.interp(ages,base_nodes,par[:len(base_nodes)]))
  l1,lmid,llate,pen,bf=par[len(base_nodes):];ef=0
  a=np.zeros(len(cases)); b=a.copy(); rows=[]
  for i in range(588):
   load=l1 if i<84 else lmid if i<120 else llate
   a+=P*(1-load);b+=P*ex*(0 if i==0 else 2 if i==1 else 1)*(1-ef)
   tot=a+b; risk=np.maximum(1000+P*ex*(i+1)-tot,0)
   cost=q[i]*risk/1000/12 + 1000*.00011/12+np.maximum(tot,0)*bf/12
   a=(a-cost)*g;b*=g
   s=np.maximum(a-P*12*pen*max(1-(i+1)/84,0),0)+b if i<84 else np.maximum(a+b,0)
   rows.append(s.copy())
  return np.array(rows)
 train=[(m,j,v) for m,j,v in obs if cases[j][0]!=2.5]
 def resid(par):
  pred=predict(par)
  res=[(pred[m-1,j]-v)/max(v,15)**.25 for m,j,v in train]
  slopes=np.diff(par[:len(base_nodes)])/np.diff(base_nodes)
  res.extend(np.diff(slopes)*5)
  return res
 initq=np.interp(base_nodes,nodes,fits[sex][:-1])
 init=np.r_[initq,.2,.2,.2,2,.002]
 low=np.r_[np.full(len(base_nodes),-7),0,0,0,0,0]
 hi=np.r_[np.full(len(base_nodes),7),.8,.8,.8,5,.03]
 out=least_squares(resid,init,bounds=(low,hi),max_nfev=150,ftol=1e-7)
 print('FINAL',sex,out.success,out.nfev,'params',out.x.tolist(),flush=True)
 pred=predict(out.x)
 for hold in [False,True]:
  vals=[(m,cases[j],v,pred[m-1,j]) for m,j,v in obs if (cases[j][0]==2.5)==hold and v>0]
  errs=[abs(p-v) for m,c,v,p in vals];rels=[abs(p-v)/v for m,c,v,p in vals]
  print('METRIC',hold,'maxmoney',max(errs),'MAPE',np.mean(rels)*100,'maxrelative',max(rels)*100,flush=True)
 print('EARLY',[(m,cases[j],v,round(pred[m-1,j],3)) for m,j,v in obs if m in [36,84,96,120] and cases[j][0]==2.5],flush=True)
 if 'export' not in globals():export={}
 export[sex]={'savings':{'ages':nodes.tolist(),'annualChargePerBillionWon':(np.exp(fits[sex][:-1])*1e6).tolist(),'balanceRate':float(fits[sex][-1])},'base':{'ages':base_nodes.tolist(),'annualChargePerBillionWon':(np.exp(out.x[:len(base_nodes)])*1e6).tolist(),'loadings':out.x[len(base_nodes):len(base_nodes)+3].tolist(),'penaltyAnnualPremiums':float(out.x[-2]),'extraLoading':0,'balanceRate':float(out.x[-1])}}
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',type=Path,default=root/'metlife/calibration.json')
args=parser.parse_args()
args.output.write_text(json.dumps(export,indent=2))
print('Wrote',args.output)
