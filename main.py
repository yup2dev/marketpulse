# This is a sample Python script.
import math

import parser


def print_hi(name):
    # Use a breakpoint in the code line below to debug your script.
    # a = 800 * 110 / 1000
    family = ['mother', 'father', 'gentleman', 'lady']

    max = 10

    while True:
        num = int(input())
        if num > max:
            print('bigger than your num')
            break
        else:
            print('goooooood')

def execParser(site_key = ""):
    aas = parser.Parser
    aas.get_title(site_key)






# Press the green button in the gutter to run the script.
if __name__ == '__main__':
    print_hi('PyCharm')

# See PyCharm help at https://www.jetbrains.com/help/pycharm/
