from selenium import selenium
import unittest, time, re

TEST_SERVER = "http://localhost:8000"

# shared functions
def _create_game(sel):
    sel.open("/login/?next=/cp/")
    sel.type("id_username", "selenium")
    sel.type("id_password", "test password")
    sel.click("//input[@value='login']")
    sel.wait_for_page_to_load("30000")
    sel.type("id_name", "Test")
    sel.click("//input[@value='Create Game']")
    sel.wait_for_page_to_load("30000")
    sel.open("/admin/logout")
    sel.wait_for_page_to_load("30000")

def _game_exists(sel):
    """
    Given the name of the game, returns whether it is true
    """
    sel.open("/admin/")
    sel.type("id_username", "selenium")
    sel.type("id_password", "test password")
    sel.click("//input[@value='Log in']")
    sel.wait_for_page_to_load("30000")
    sel.click("link=Games")
    sel.wait_for_page_to_load("30000")
    count = int(sel.get_xpath_count("//th/a[text()='Test']"))
    game_exists = count > 0 
    sel.open("/admin/logout")
    sel.wait_for_page_to_load("30000")
    return game_exists

def _delete_game(sel):
    sel.open("/admin/")
    sel.type("id_username", "selenium")
    sel.type("id_password", "test password")
    sel.click("//input[@value='Log in']")
    sel.wait_for_page_to_load("30000")
    sel.click("link=Games")
    sel.wait_for_page_to_load("30000")
    sel.click("//th/a[text()='Test']/../../td/input")
    sel.select("action", "label=Delete selected games")
    sel.click("index")
    sel.wait_for_page_to_load("30000")
    sel.click("//input[@value=\"Yes, I'm sure\"]")
    sel.wait_for_page_to_load("30000")
    sel.click("link=Log out")
    sel.wait_for_page_to_load("30000")

def setUpModule():
    sel = selenium("localhost", 4444, "*chrome", TEST_SERVER)
    sel.start()

    # if game "Test" exists, delete
    # and then create
    if _game_exists(sel):
        _delete_game(sel)
    _create_game(sel)

    sel.stop()

def tearDownModule():
    sel = selenium("localhost", 4444, "*chrome", TEST_SERVER)
    sel.start()
    _delete_game(sel)
    sel.stop()


class CreateGameTest(unittest.TestCase):
    def setUp(self):
        self.verificationErrors = []
        self.selenium = selenium("localhost", 4444, "*chrome", TEST_SERVER)
        self.selenium.start()
    
    def test_create_game(self):
        _create_game(self.selenium)
   
    def tearDown(self):
        _delete_game(self.selenium)
        self.selenium.stop()
        self.assertEqual([], self.verificationErrors)


class PlayGameTest(unittest.TestCase):
    def setUp(self):
        self.verificationErrors = []
        self.selenium = selenium("localhost", 4444, "*chrome", TEST_SERVER)
        self.selenium.start()

    def _play_game(self, role):
        # state
        current_period = 0

        sel = self.selenium

        # open homepage
        sel.open("/")

        # join game
        sel.click("link=Test")
        sel.wait_for_page_to_load("30000")

        # select role
        sel.click("link=%s" % (role))
        sel.wait_for_page_to_load("30000")

        # verify current period is shown
        if self.current_period == 0:
            try: self.assertEqual(sel.get_text("//h2[@id='period_num']"), "Just started")
            except AssertionError, e: self.verificationErrors.append(str(e))

        # verify correct role is displayed
        try: self.failUnless(sel.is_text_present(role))
        except AssertionError, e: self.verificationErrors.append(str(e))

        sel.click("next_period_btn")
        current_period += 1 # increment our period as well
        try: self.assertEqual(sel.get_text("//h2[@id='period_num']"), str(current_period))
        except AssertionError, e: self.verificationErrors.append(str(e))

        sel.click("step1_btn")
        # make sure we display a waiting for shipment button
        sel.wait_for_condition('selenium.getText("//p[@id=\'ship2_amt\']") == "Waiting for Shipment from Supplier"', "10000")

        sel.click("step2_btn")

        self.assert_(sel.get_eval("$ = window.jQuery; $(\'#ship_btn\').attr(\'disabled\')"))

        # need to wait for downstream slot to open up to ship
        sel.wait_for_condition('selenium.getEval("$ = window.jQuery; !($(\'#ship_btn\').attr(\'disabled\'))")', "60000")
        sel.wait_for_condition('selenium.getValue("//input[@id=\'ship_btn\']") == "Ship"', "60000")
        sel.click("ship_btn")

        try: self.assertEqual(sel.get_text("//div[@id='shipment_errors']"), "")
        except AssertionError, e: self.verificationErrors.append(str(e))

        sel.wait_for_condition('selenium.getEval("$ = window.jQuery; !($(\'#step3_btn\').attr(\'disabled\'))")', "60000")
        sel.click("step3_btn")

        # need to wait for order slot upstream to open
        sel.type("amt_to_order", "4")

        sel.wait_for_condition('selenium.getEval("$ = window.jQuery; !($(\'#order_btn\').attr(\'disabled\'))")', "60000")
        sel.wait_for_condition('selenium.getValue("//input[@id=\'order_btn\']") == "Order"', "60000")
        sel.click("order_btn")

        # start the next period

    def test_play_factory(self):
        self._play_game('Factory')

    def test_play_distributor(self):
        self._play_game('Distributor')

    def test_play_wholesaler(self):
        self._play_game('Wholesaler')

    def test_play_retailer(self):
        self._play_game('Retailer')

    def tearDown(self):
        self.selenium.stop()
        self.assertEqual([], self.verificationErrors)

if __name__ == "__main__":
    unittest.main()
