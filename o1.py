with open('src/App.jsx','r') as f: c=f.read()
ok=0;tot=0
def rep(old,new,label):
    global c,ok,tot;tot+=1
    n=c.count(old);print(f"{label}: {n}")
    if n>=1:c=c.replace(old,new,1);ok+=1

# Texte de la convergence : "trois" -> "quatre" + ajouter le 4e angle
rep('''Chacun seul peut mentir. Le Currency Strength peut montrer un piège du matin. Le retail peut être extrême sans suite. Le COT a quelques jours de décalage. Mais les trois mentent rarement en même temps, dans le même sens.

          Quand le flux temps réel (①), le carburant de la foule (②) et le flux frais des fonds (③) pointent tous vers la même paire → tu n'es pas sur une illusion. Tu es sur un vrai courant institutionnel, confirmé sous trois angles indépendants qui se compensent : le temps réel corrige le décalage du COT, et le COT ancre ce que le temps réel montre.''',
    '''Chacun seul peut mentir. Le Currency Strength peut montrer un piège du matin. Le retail peut être extrême sans suite. Le COT a quelques jours de décalage. Le mouvement du jour peut être une sortie. Mais les quatre mentent rarement en même temps, dans le même sens.

          Quand le flux temps réel (①), le carburant de la foule (②), le flux frais des fonds (③) et le mouvement réel du jour (④) pointent tous vers la même paire → tu n'es pas sur une illusion. Tu es sur un vrai courant institutionnel, confirmé sous quatre angles indépendants qui se compensent.''',"conv_texte")

with open('src/App.jsx','w') as f: f.write(c)
print(f"=== {ok}/{tot}")
