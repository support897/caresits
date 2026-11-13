import json
d=json.load(open('/home/user/bank.json'))
def s(x): return '"'+x.replace('\\','\\\\').replace('"','\\"')+'"'
import re
QRULES=[('first aid','firstAid'),('allerg','warning'),('medicine','pill'),('screen','screen'),('phone','phone'),('photo','camera'),('camera','camera'),('sleep','bed'),('nap','bed'),('meal','bowl'),('food','bowl'),('treat','gift'),('eat','bowl'),('swim','swim'),('pool','swim'),('driv','car'),('language','chat'),('reply','chat'),('hear about','chat'),('talk','chat'),('update','chat'),('sort it out','chat'),('unhappy','chat'),('at one time','group'),('families','group'),('two families','group'),('friends','key'),('guest','key'),('visit','key'),('home by','key'),('centre','school'),('school','school'),('holiday','calendar'),('trial','calendar'),('long','hourglass'),('stay','hourglass'),('plan to','hourglass'),('overnight','moon'),('vape','smoke'),('smok','smoke'),('pay','rate'),('active','sun'),('guid','heart'),('listen','heart'),('time out','clock'),('child','child'),('hazard','warning'),('need','heart'),('experience','star'),('worked','school'),('settl','bell'),('first days','bell'),('write','pencil'),('best at','star'),('love','heart')]
ORULES=[(r'^yes|happy|we use|fine|always|agree|love','check'),(r'^no\b|never|do not|would rather not|not allowed|not happy','cross'),(r'either|flexible|no set view|no preference|depends','circle'),(r'screen|tv|tablet','screen'),(r'phone','phone'),(r'photo','camera'),(r'sleep|nap|bed','bed'),(r'swim|pool','swim'),(r'drive|car','car'),(r'cook|meal|food|snack|vegetarian|meat','bowl'),(r'allerg|nut|dairy|egg|gluten|soy|sesame|fish|shellfish|lupin','warning'),(r'medicine','pill'),(r'time out|clock|minute|hour|week|month|year|term','hourglass'),(r'holiday|trial|date|day','calendar'),(r'message|chat|text|email|call|talk|update|report|photos? of the day','chat'),(r'school|centre|nursery|teacher','school'),(r'baby|newborn|infant|toddler|child','child'),(r'group|two|three|four|five','group'),(r'calm|quiet|gentle','moon'),(r'active|busy|outdoor|sport|park','sun'),(r'music|song','note'),(r'book|read|homework|learn','book'),(r'pet|dog|animal','paw'),(r'guest|friend|visit|home by','key'),(r'cash|pay|money|\$|bank|week','rate'),(r'language|speak|english','chat'),(r'first aid|cpr','firstAid'),(r'warn|rule|firm','shield'),(r'smok|vape','smoke'),(r'reminder|notif','bell'),(r'gift|treat|sweet','gift'),(r'plan|routine|schedule','calendar')]
def qicon(label):
    l=label.lower()
    for k,i in QRULES:
        if k in l: return i
    return 'star'
OEXACT={"babysitter":"moon","nanny":"nanny","au pair":"globe","mother's help":"home","newborn and overnight":"child","governess":"book","childminder":"home",
"warm":"heart","patient":"hourglass","playful":"ball","calm":"moon","energetic":"sun","organised":"calendar","gentle":"heart","funny":"sparkle","reliable":"shield","creative":"pencil",
"light cleaning":"sparkle","laundry":"tray","bath time":"swim","errands":"car","school runs":"school","cooking":"bowl","homework help":"book","bedtime":"bed",
"our food":"bowl","our language":"globe","our songs and stories":"note","our festivals":"sparkle","our faith practices":"heart","cooking together":"bowl","homework in our language":"book",
"register verified":"shield","document sighted":"doc","getting them now":"clock","as soon as possible":"clock","in the next few weeks":"calendar","i am flexible":"circle",
"steady rhythm":"clock","go with the flow":"sun","busy and active":"ball","calm and quiet":"moon","arts and crafts":"pencil","going to the park":"leaf","library":"book","reading and storytime":"book","music":"note","swimming":"swim","sports and active play":"ball","games and puzzles":"ball","nature time":"leaf","pretend play":"bunny",
"english":"globe","spanish":"globe","mandarin":"globe","arabic":"globe","hindi":"globe","tagalog":"globe","italian":"globe","greek":"globe","vietnamese":"globe","french":"globe",
"0-1":"child","1-3":"child","3-5":"child","5-12":"child","12+":"person","none of these":"circle","none":"circle","speech":"chat","moving around":"person","toilet training":"child",
"drives, own car":"car","drives, our car":"car","no driving needed":"circle","i drive, my own car":"car","i drive, family car is fine":"car","i do not drive":"circle"}
def oicon(o,label):
    l=o.lower()
    if l in OEXACT: return OEXACT[l]
    if re.fullmatch(r'\d+',l): return 'rate' if ('pay' in label.lower() or 'dollar' in label.lower()) else ('pin' if 'km' in label.lower() or 'distance' in label.lower() or 'travel' in label.lower() else 'clock')
    for r,i in ORULES:
        if re.search(r,l): return i
    return qicon(label)
def opts(o,label=''):
    if not o or len(o)>12: return '['+', '.join('QOpt('+s(x)+')' for x in (o or []))+']'
    return '['+', '.join('QOpt('+s(x)+', icon: .'+oicon(x,label)+')' for x in o)+']'

KIND={'select':'.pick','chips':'.many','yesno':'.yesno','text':'.text','grid':'.grid','band':'.band','expchecks':'.expChecks','experience':'.experience','homefacts':'.homeFacts'}
# tick sets from her mock (ids prefixed tk), added by her 13 Nov 14:04 correction
tick={'family':[
 ('tkHome','At home','Tick all that live with you','.many',[('Dog','paw'),('Cat','cat'),('Garden','leaf')],'many'),
 ('tkNeed','Help your carer must have','Tick the ones that matter most','.many',[('Can drive','wheel'),('First aid','firstAid'),('CPR trained','heart'),('Strong swimmer','swim'),('Cooking','bowl'),('Homework help','book'),('Happy with pets','paw'),('Speaks two languages','chat')],'many'),
 ('tkFeel','The feel you want at home','Pick up to three','.many3',[('Calm','moon'),('Playful','ball'),('Gentle','heart'),('Firm','shield'),('Outdoorsy','sun'),('Musical','note')],'many3')],
 'carer':[
 ('tkSkill','My skills','Tick all that are true for you','.many',[('Driving licence','wheel'),('First aid','firstAid'),('CPR trained','heart'),('Strong swimmer','swim'),('Cooking','bowl'),('Homework help','book'),('Happy with pets','paw'),('Two languages','chat'),('Own kids','child')],'many'),
 ('tkStyle','My style with kids','Pick up to three','.many3',[('Calm','moon'),('Playful','ball'),('Gentle','heart'),('Firm','shield'),('Outdoorsy','sun'),('Musical','note')],'many3')]}
out=['// GENERATED by gen_bank.py from app2/questions.js + app2/questions2.js (main branch) and the 13 Nov tick card mock.','// Do not hand edit. Base 23 + 27 kept expansion = 50 family; base 21 + 29 kept = 50 carer. tk* ids are the mock tick sets.','import Foundation','','enum QKind { case pick, many, many3, yesno, text, grid, band, expChecks, experience, homeFacts }','struct QOpt { let label: String; var icon: BI? = nil; init(_ label: String, icon: BI? = nil) { self.label = label; self.icon = icon } }','struct QDef { let id: String; let code: String; let feed: String; let set: String; let page: String; let label: String; let hint: String; let kind: QKind; let options: [QOpt]; let level: String; let required: Bool; let strength: Bool; let optional: Bool }','','enum QuestionBank {']
for side in ['family','carer']:
    out.append(f'    static let {side}: [QDef] = [')
    for q in d[side]:
        k=KIND[q['type']]
        if q['id']=='culture': k='.many'; q['options']=['Our food','Our language','Our songs and stories','Our festivals','Our faith practices','Cooking together','Homework in our language']
        out.append(f'        QDef(id: {s(q["id"])}, code: {s(q.get("pair") or "")}, feed: {s(q.get("feed") or "")}, set: {s(q["set"])}, page: {s(q["page"])}, label: {s(q["label"])}, hint: "", kind: {k}, options: {opts(q["options"],q["label"])}, level: {s(q["level"])}, required: {str(q["required"]).lower()}, strength: {str(q["strength"]).lower()}, optional: {str(q["optional"]).lower()}),')
    for (i,t,h,k,o,_) in tick[side]:
        os=', '.join(f'QOpt({s(l)}, icon: .{ic})' for l,ic in o)
        out.append(f'        QDef(id: {s(i)}, code: "", feed: "", set: "tick", page: {s(t)}, label: {s(t)}, hint: {s(h)}, kind: {k}, options: [{os}], level: "optional", required: false, strength: false, optional: true),')
    out.append('    ]')
out.append('}')
open('/home/user/QuestionBank.swift','w').write('\n'.join(out)+'\n')
print(len(out))
